/** Session storage survives service-worker suspension and is not included in user exports. */
export const RESTORE_RECOVERY_KEY = 'jpRestoreRecovery';

async function replaceSnapshot(snapshot: Record<string, unknown>): Promise<void> {
  // Write first: a rejected write never clears the original data.
  await chrome.storage.local.set(snapshot);
  const current = await chrome.storage.local.get(null);
  const stale = Object.keys(current).filter(key => !Object.prototype.hasOwnProperty.call(snapshot, key));
  if (stale.length) await chrome.storage.local.remove(stale);
}

/** Called under the storage queue before any read/mutation after an interrupted restore. */
export async function recoverInterruptedRestore(): Promise<void> {
  const journal = (await chrome.storage.session.get(RESTORE_RECOVERY_KEY))[RESTORE_RECOVERY_KEY] as
    { previous: Record<string, unknown> } | undefined;
  if (!journal) return;
  await replaceSnapshot(journal.previous);
  await chrome.storage.session.remove(RESTORE_RECOVERY_KEY);
}

/** Caller holds the shared storage transaction for journal, replacement, and rollback. */
export async function restoreStorageSafely(snapshot: Record<string, unknown>): Promise<void> {
  const previous = await chrome.storage.local.get(null);
  await chrome.storage.session.set({ [RESTORE_RECOVERY_KEY]: { previous } });
  try {
    await replaceSnapshot(snapshot);
    await chrome.storage.session.remove(RESTORE_RECOVERY_KEY);
  } catch {
    try {
      await recoverInterruptedRestore();
    } catch {
      throw new Error('Restore failed. A recovery copy is retained for the next attempt; your previous data will be recovered before further changes.');
    }
    throw new Error('Restore failed. Your previous data has been restored.');
  }
}
