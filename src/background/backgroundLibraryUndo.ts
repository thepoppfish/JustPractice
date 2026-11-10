import { LIBRARY_UNDO_KEY, type LibraryUndoOffer } from '../lib/libraryUndo';
import type { LibraryItem, PersistedData } from '../lib/storage';

interface Removal extends LibraryUndoOffer {
  item: LibraryItem;
  index: number;
}
interface UndoStore { current: Removal; previous: Removal | null }
const TTL = 24 * 60 * 60 * 1000;

function valid(record: Removal | null | undefined): record is Removal {
  return Boolean(record && typeof record.token === 'string' && typeof record.title === 'string' &&
    Number.isFinite(record.expiresAt) && record.expiresAt > Date.now() && record.item?.videoId && Number.isInteger(record.index));
}

/** If a staged removal failed, its unchanged membership still exists: retain the prior offer. */
function active(store: UndoStore | undefined, data: PersistedData): Removal | null {
  if (!store || !valid(store.current)) return null;
  const item = data.library.find((row) => row.videoId === store.current.item.videoId);
  if (!item) return store.current;
  // Undo or manual re-save creates a new membership. Never offer an older snapshot over it.
  if (item.practiceToken !== store.current.item.practiceToken) return null;
  if (valid(store.previous) && !data.library.some((row) => row.videoId === store.previous!.item.videoId)) return store.previous;
  return null;
}

async function read(): Promise<UndoStore | undefined> {
  return (await chrome.storage.session.get(LIBRARY_UNDO_KEY))[LIBRARY_UNDO_KEY] as UndoStore | undefined;
}

function offer(removal: Removal | null): LibraryUndoOffer | null {
  return removal ? { token: removal.token, title: removal.title, expiresAt: removal.expiresAt } : null;
}

/** Caller holds the shared storage queue. Session failure occurs before any item is removed. */
export async function stageRemoval(data: PersistedData, item: LibraryItem, index: number): Promise<LibraryUndoOffer> {
  const current: Removal = { token: crypto.randomUUID(), title: item.title, expiresAt: Date.now() + TTL, item: { ...item }, index };
  const previous = active(await read(), data);
  await chrome.storage.session.set({ [LIBRARY_UNDO_KEY]: { current, previous } satisfies UndoStore });
  return offer(current)!;
}

export async function getLibraryUndo(data: PersistedData): Promise<LibraryUndoOffer | null> {
  return offer(active(await read(), data));
}

export async function undoLibraryRemoval(data: PersistedData, token: string, write: (data: PersistedData) => Promise<void>): Promise<boolean> {
  const removal = active(await read(), data);
  if (!removal || removal.token !== token) return false;
  data.library.splice(Math.max(0, Math.min(removal.index, data.library.length)), 0, {
    ...removal.item, practiceToken: crypto.randomUUID(),
  });
  await write(data);
  // The persistent write committed. Optional cleanup must not report it as a failed undo.
  try { await chrome.storage.session.remove(LIBRARY_UNDO_KEY); } catch { /* active() rejects the restored membership. */ }
  return true;
}

export async function dismissLibraryUndo(data: PersistedData, token: string): Promise<void> {
  if (active(await read(), data)?.token === token) await clearLibraryUndo();
}

export async function clearLibraryUndo(): Promise<void> {
  await chrome.storage.session.remove(LIBRARY_UNDO_KEY);
}
