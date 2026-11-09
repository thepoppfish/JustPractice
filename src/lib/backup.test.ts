import { describe, expect, it } from 'vitest';
import { BackupValidationError, MAX_BACKUP_BYTES, prepareBackup } from './backup';
import { emptyPersisted, SCHEMA_VERSION } from './storageTypes';

describe('backup validation', () => {
  it.each([null, [], {}, { unrelated: true }, { jpPractice: null }, { jpPractice: [] }])('rejects an unrecognized payload: %j', raw => {
    expect(() => prepareBackup(raw)).toThrow(BackupValidationError);
  });

  it.each([0, -1, 1.5, '16', SCHEMA_VERSION + 1, undefined])('rejects unsupported schema %j', schemaVersion => {
    expect(() => prepareBackup({ jpPractice: { ...emptyPersisted(), schemaVersion } })).toThrow(BackupValidationError);
  });

  it.each([
    { library: [null] },
    { library: [{ videoId: 'not a video' }] },
    { dailySeconds: { '2026-13-01': 10 } },
    { dailySeconds: { '2026-02-30': 10 } },
    { dailySeconds: { '2026-11-09': 'bad' } },
    { videoSeconds: { abcdefghijk: -5 } },
    { videoDailySeconds: { abcdefghijk: { '2026-11-09': null } } },
    { settings: { pauseWhenUnfocused: 'true' } },
    { settings: { goals: { dailyTargetSec: NaN } } },
    { playerProgress: { achievements: { first_save: Infinity } } },
  ])('rejects malformed nested data: %j', patch => {
    expect(() => prepareBackup({ jpPractice: { ...emptyPersisted(), ...patch } })).toThrow(BackupValidationError);
  });

  it('rejects oversized snapshots before migration', () => {
    expect(() => prepareBackup({ jpPractice: emptyPersisted(), extra: 'x'.repeat(MAX_BACKUP_BYTES) })).toThrow(BackupValidationError);
  });

  it('accepts genuine empty and populated exports and summarizes practice', () => {
    const data = emptyPersisted();
    data.library.push({ videoId: 'abcdefghijk', title: 'Lesson', channel: 'Teacher', addedAt: 1, difficulty: 'N5', completedAt: 2, durationSec: 120 });
    data.dailySeconds['2026-11-09'] = 125;
    const raw = { jpPractice: data, jpDebugXp: true };
    const prepared = prepareBackup(raw);
    expect(prepared.summary).toEqual({ videos: 1, completed: 1, minutes: 2 });
    expect(prepared.storage).toEqual(raw);
    expect(prepareBackup({ jpPractice: emptyPersisted() }).summary.videos).toBe(0);
  });

  it('migrates recognized older exports without requiring newer optional fields', () => {
    const legacy = { schemaVersion: 1, library: [], dailySeconds: {}, videoSeconds: {}, settings: {} };
    expect(prepareBackup({ jpPractice: legacy }).storage.jpPractice.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
