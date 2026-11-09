import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MSG } from '../lib/messages';
import {
  dateKeyFromTimestamp,
  emptyPersisted,
  readPersisted,
  STORAGE_KEY,
  type PersistedData,
} from '../lib/storage';
import { enrichLibraryItemDuration } from './backgroundDurationEnrich';
import { handleBackgroundMessage } from './backgroundMessageHandlers';
import { enrichLibraryItemFromOEmbed } from './backgroundOEmbed';
import { RESTORE_RECOVERY_KEY } from '../lib/storageRecovery';

vi.mock('./backgroundContextMenus', () => ({ rebuildContextMenusFromStorage: vi.fn() }));

const VIDEO_ID = 'abcdefghijk';
const NOW = new Date(2026, 10, 9, 12).getTime();
const DAY = dateKeyFromTimestamp(NOW);
let stored: Record<string, unknown>;
let sessionStored: Record<string, unknown>;
const fetchMock = vi.fn<typeof fetch>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function holdNextFetch() {
  const started = deferred<void>();
  const response = deferred<Response>();
  fetchMock.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  return { started: started.promise, finish: response.resolve };
}

function holdNextStorageWrite() {
  const started = deferred<void>();
  const finished = deferred<void>();
  const write = vi.mocked(chrome.storage.local.set).getMockImplementation()!;
  vi.mocked(chrome.storage.local.set).mockImplementationOnce(async (values) => {
    started.resolve();
    await finished.promise;
    await write(values, () => {});
  });
  return { started: started.promise, finish: () => finished.resolve() };
}

function metadataResponse() {
  return new Response(JSON.stringify({ title: 'Fetched title', author_name: 'Fetched channel' }));
}

function practiceTick(deltaSeconds = 60) {
  return handleBackgroundMessage({
    type: MSG.PRACTICE_TICK,
    payload: { videoId: VIDEO_ID, deltaSeconds, endedAtMs: NOW },
  });
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const data = emptyPersisted();
  data.library.push({
    videoId: VIDEO_ID,
    title: 'Unknown title',
    channel: 'Unknown channel',
    addedAt: NOW - 1000,
    difficulty: null,
    completedAt: null,
    durationSec: null,
  });
  stored = { [STORAGE_KEY]: data };
  sessionStored = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        // Chrome returns independent snapshots, not references to the stored object.
        get: vi.fn(async (key: string | null) => key === null ? structuredClone(stored) : ({ [key]: structuredClone(stored[key]) })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(stored, structuredClone(values));
        }),
        clear: vi.fn(async () => { stored = {}; }),
        remove: vi.fn(async (keys: string[]) => { for (const key of keys) delete stored[key]; }),
      },
      session: {
        get: vi.fn(async (key: string) => ({ [key]: structuredClone(sessionStored[key]) })),
        set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(sessionStored, structuredClone(values)); }),
        remove: vi.fn(async (key: string) => { delete sessionStored[key]; }),
      },
    },
  });
  fetchMock.mockReset().mockImplementation(async () => new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  await readPersisted();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('background storage concurrency', () => {
  it.each(['remove', 'clear', 'restore'] as const)(
    'ignores a stale practice tick queued behind %s',
    async (action) => {
      await practiceTick(30);
      const write = holdNextStorageWrite();
      const backup = emptyPersisted();
      backup.dailySeconds[DAY] = 900;
      const mutation = action === 'remove'
        ? handleBackgroundMessage({ type: MSG.REMOVE_LIBRARY, payload: { videoId: VIDEO_ID } })
        : action === 'clear'
          ? handleBackgroundMessage({ type: MSG.CLEAR_ALL_EXTENSION_DATA })
          : handleBackgroundMessage({ type: MSG.RESTORE_EXTENSION_STORAGE, payload: { [STORAGE_KEY]: backup } });
      await write.started;
      const lateTick = practiceTick(60);
      write.finish();
      await mutation;
      const snapshot = structuredClone(stored);
      expect(await lateTick).toMatchObject({ ok: true, xpGained: 0 });
      expect(stored).toEqual(snapshot);
      const data = await readPersisted();
      expect(data.library).toEqual([]);
      expect(data.dailySeconds).toEqual(action === 'remove' ? { [DAY]: 30 } : action === 'restore' ? { [DAY]: 900 } : {});
    },
  );

  it('keeps both simultaneous practice ticks, including sub-minute XP carry', async () => {
    await Promise.all([practiceTick(30), practiceTick(30)]);

    const data = await readPersisted();
    expect(data.dailySeconds[DAY]).toBe(60);
    expect(data.videoSeconds[VIDEO_ID]).toBe(60);
    expect(data.videoDailySeconds[VIDEO_ID][DAY]).toBe(60);
    expect(data.playerProgress.practiceXpCarrySeconds).toBe(0);
    expect(data.playerProgress.totalXp).toBeGreaterThan(0);
  });

  it('keeps independent library edits and practice updates that arrive together', async () => {
    await Promise.all([
      practiceTick(),
      handleBackgroundMessage({
        type: MSG.SET_DIFFICULTY,
        payload: { videoId: VIDEO_ID, difficulty: 'N3' },
      }),
      handleBackgroundMessage({
        type: MSG.SET_VIDEO_PLAYBACK_POSITION,
        payload: { videoId: VIDEO_ID, positionSec: 180 },
      }),
      handleBackgroundMessage({
        type: MSG.SET_VIDEO_DURATION,
        payload: { videoId: VIDEO_ID, durationSec: 600 },
      }),
    ]);

    const data = await readPersisted();
    expect(data.dailySeconds[DAY]).toBe(60);
    expect(data.library[0]).toMatchObject({ difficulty: 'N3', durationSec: 600 });
    expect(data.videoPlaybackPositionSec[VIDEO_ID]).toBe(180);
  });

  it('merges delayed metadata into the latest state without losing user actions', async () => {
    const request = holdNextFetch();
    const enrichment = enrichLibraryItemFromOEmbed(VIDEO_ID);
    await request.started;

    await practiceTick();
    await handleBackgroundMessage({ type: MSG.SET_SETTINGS, payload: { displayName: 'Learner' } });
    await handleBackgroundMessage({
      type: MSG.SET_DIFFICULTY,
      payload: { videoId: VIDEO_ID, difficulty: 'N2' },
    });
    const latest = await readPersisted();
    request.finish(metadataResponse());
    await enrichment;

    expect(await readPersisted()).toEqual({
      ...latest,
      library: [{ ...latest.library[0], title: 'Fetched title', channel: 'Fetched channel' }],
    });
  });

  it.each(['remove', 'clear', 'restore'] as const)(
    'does not resurrect old data when metadata finishes after %s',
    async (action) => {
      const request = holdNextFetch();
      const enrichment = enrichLibraryItemFromOEmbed(VIDEO_ID);
      await request.started;
      if (action === 'remove') {
        await handleBackgroundMessage({ type: MSG.REMOVE_LIBRARY, payload: { videoId: VIDEO_ID } });
      } else if (action === 'clear') {
        await handleBackgroundMessage({ type: MSG.CLEAR_ALL_EXTENSION_DATA });
      } else {
        const backup = emptyPersisted();
        backup.settings.displayName = 'Restored profile';
        backup.dailySeconds[DAY] = 900;
        await handleBackgroundMessage({
          type: MSG.RESTORE_EXTENSION_STORAGE,
          payload: { [STORAGE_KEY]: backup, otherKey: 'preserve backup keys' },
        });
      }
      const latest = structuredClone(stored);
      request.finish(metadataResponse());
      await enrichment;

      expect(stored).toEqual(latest);
    },
  );

  it.each(['fill-unknown', 'overwrite'] as const)(
    'preserves metadata edited during a pending %s request',
    async (mode) => {
      const request = holdNextFetch();
      const enrichment = enrichLibraryItemFromOEmbed(VIDEO_ID, mode);
      await request.started;
      await handleBackgroundMessage({
        type: MSG.ADD_OR_UPDATE_LIBRARY,
        payload: { videoId: VIDEO_ID, title: 'Newer title', channel: 'Newer channel' },
      });
      request.finish(metadataResponse());
      await enrichment;

      expect((await readPersisted()).library[0]).toMatchObject({
        title: 'Newer title', channel: 'Newer channel',
      });
    },
  );

  it.each(['fill-unknown', 'overwrite'] as const)(
    'respects %s mode when the existing metadata has not changed',
    async (mode) => {
      (stored[STORAGE_KEY] as PersistedData).library[0].title = 'Original title';
      (stored[STORAGE_KEY] as PersistedData).library[0].channel = 'Original channel';
      fetchMock.mockResolvedValueOnce(metadataResponse());
      await enrichLibraryItemFromOEmbed(VIDEO_ID, mode);

      expect((await readPersisted()).library[0]).toMatchObject(mode === 'overwrite'
        ? { title: 'Fetched title', channel: 'Fetched channel' }
        : { title: 'Original title', channel: 'Original channel' });
    },
  );

  it('ignores metadata for a removed and re-added library entry', async () => {
    const request = holdNextFetch();
    const enrichment = enrichLibraryItemFromOEmbed(VIDEO_ID);
    await request.started;
    await handleBackgroundMessage({ type: MSG.REMOVE_LIBRARY, payload: { videoId: VIDEO_ID } });
    await handleBackgroundMessage({
      type: MSG.ADD_OR_UPDATE_LIBRARY,
      payload: { videoId: VIDEO_ID, title: 'Unknown title', channel: 'Unknown channel' },
    });
    request.finish(metadataResponse());
    await enrichment;

    expect((await readPersisted()).library[0].title).toBe('Unknown title');
  });

  it.each(['metadata', 'duration backfill'] as const)(
    'allows practice updates while %s is waiting on YouTube',
    async (kind) => {
      const request = holdNextFetch();
      const enrichment = handleBackgroundMessage(kind === 'metadata'
        ? { type: MSG.ENRICH_LIBRARY_META, payload: { videoId: VIDEO_ID } }
        : { type: MSG.BACKFILL_LIBRARY_DURATIONS, payload: { limit: 1 } });
      await request.started;
      try {
        expect(await practiceTick()).toMatchObject({ ok: true });
      } finally {
        request.finish(kind === 'metadata' ? metadataResponse() : new Response('"lengthSeconds":"600"'));
        await enrichment;
      }
      expect((await readPersisted()).dailySeconds[DAY]).toBe(60);
    },
  );

  it('does not overwrite a duration captured while a duration request was in flight', async () => {
    const request = holdNextFetch();
    const enrichment = enrichLibraryItemDuration(VIDEO_ID);
    await request.started;
    await handleBackgroundMessage({
      type: MSG.SET_VIDEO_DURATION, payload: { videoId: VIDEO_ID, durationSec: 500 },
    });
    await practiceTick();
    request.finish(new Response('"lengthSeconds":"600"'));

    expect(await enrichment).toBe(false);
    const data = await readPersisted();
    expect(data.library[0].durationSec).toBe(500);
    expect(data.dailySeconds[DAY]).toBe(60);
  });

  it('keeps a practice tick that arrives during the duration storage write', async () => {
    const write = holdNextStorageWrite();
    fetchMock.mockResolvedValueOnce(new Response('"lengthSeconds":"600"'));
    const enrichment = enrichLibraryItemDuration(VIDEO_ID);
    await write.started;
    const tick = practiceTick();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    write.finish();
    await Promise.all([enrichment, tick]);

    const data = await readPersisted();
    expect(data.library[0].durationSec).toBe(600);
    expect(data.dailySeconds[DAY]).toBe(60);
  });

  it('continues processing later updates after a storage write fails', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(practiceTick()).rejects.toThrow('Storage unavailable');
    await expect(practiceTick(30)).resolves.toMatchObject({ ok: true });
    expect((await readPersisted()).dailySeconds[DAY]).toBe(30);
  });

  it('serializes practice updates with backup replacement', async () => {
    const write = holdNextStorageWrite();
    const backup = emptyPersisted();
    // This restored video remains saved, so the queued tick should still be accepted.
    backup.library = structuredClone((stored[STORAGE_KEY] as PersistedData).library);
    backup.dailySeconds[DAY] = 600;
    backup.videoSeconds[VIDEO_ID] = 600;
    const restore = handleBackgroundMessage({
      type: MSG.RESTORE_EXTENSION_STORAGE, payload: { [STORAGE_KEY]: backup },
    });
    await write.started;
    const tick = practiceTick();
    // Let a competing handler attempt its storage read while replacement is pending.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    write.finish();
    await Promise.all([restore, tick]);

    const data = await readPersisted();
    expect(data.dailySeconds[DAY]).toBe(660);
    expect(data.videoSeconds[VIDEO_ID]).toBe(660);
  });

  it('rejects unrelated and malformed backups without writing or clearing data', async () => {
    const previous = structuredClone(stored);
    for (const payload of [{}, { unrelated: true }, { jpPractice: {} }, { jpPractice: { ...emptyPersisted(), dailySeconds: { '2026-11-09': 'bad' } } }]) {
      expect(await handleBackgroundMessage({ type: MSG.RESTORE_EXTENSION_STORAGE, payload })).toMatchObject({ ok: false });
    }
    expect(stored).toEqual(previous);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.clear).not.toHaveBeenCalled();
  });

  it.each(['write', 'remove'] as const)('rolls back a failed restore %s and retains all previous keys', async (failure) => {
    stored.oldPreference = 'keep this';
    const previous = structuredClone(stored);
    if (failure === 'write') vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('Quota exceeded'));
    else vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(new Error('Removal failed'));
    const response = await handleBackgroundMessage({
      type: MSG.RESTORE_EXTENSION_STORAGE,
      payload: { jpPractice: emptyPersisted(), newKey: 'new preference' },
    });
    expect(response).toMatchObject({ ok: false, error: expect.stringContaining('previous data has been restored') });
    expect(stored).toEqual(previous);
    expect(sessionStored).toEqual({});
  });

  it('leaves local data intact when the recovery copy cannot be saved', async () => {
    const previous = structuredClone(stored);
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('Session quota exceeded'));
    expect(await handleBackgroundMessage({ type: MSG.RESTORE_EXTENSION_STORAGE, payload: { jpPractice: emptyPersisted() } })).toMatchObject({ ok: false });
    expect(stored).toEqual(previous);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('retains a failed rollback and recovers before the next mutation', async () => {
    const previous = structuredClone(stored);
    vi.mocked(chrome.storage.local.set)
      .mockRejectedValueOnce(new Error('Restore write failed'))
      .mockRejectedValueOnce(new Error('Rollback write failed'));
    expect(await handleBackgroundMessage({ type: MSG.RESTORE_EXTENSION_STORAGE, payload: { jpPractice: emptyPersisted() } })).toMatchObject({ ok: false });
    expect(sessionStored[RESTORE_RECOVERY_KEY]).toEqual({ previous });
    await practiceTick();
    expect((await readPersisted()).dailySeconds[DAY]).toBe(60);
    expect(sessionStored).toEqual({});
  });

  it('recovers an interrupted replacement before returning state', async () => {
    const previous = structuredClone(stored);
    sessionStored[RESTORE_RECOVERY_KEY] = { previous };
    stored = { jpPractice: emptyPersisted(), unfinishedRestoreKey: 'remove me' };
    await readPersisted();
    expect(stored).toEqual(previous);
    expect(sessionStored).toEqual({});
  });

  it('replaces the full snapshot and removes obsolete keys after a successful restore', async () => {
    stored.obsolete = true;
    const snapshot = { jpPractice: emptyPersisted(), importedPreference: false };
    expect(await handleBackgroundMessage({ type: MSG.RESTORE_EXTENSION_STORAGE, payload: snapshot })).toMatchObject({ ok: true });
    expect(stored).toEqual(snapshot);
    expect(sessionStored).toEqual({});
    expect(chrome.storage.local.clear).not.toHaveBeenCalled();
  });

  it('serializes migration rewrites with practice updates', async () => {
    (stored[STORAGE_KEY] as PersistedData).schemaVersion = 15;
    const write = holdNextStorageWrite();
    const migration = readPersisted();
    await write.started;
    const tick = practiceTick();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    write.finish();
    await Promise.all([migration, tick]);

    const data = await readPersisted();
    expect(data.dailySeconds[DAY]).toBe(60);
    expect(data.videoSeconds[VIDEO_ID]).toBe(60);
  });
});
