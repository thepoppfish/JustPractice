import type { PersistedData } from './storageTypes';
import { STORAGE_KEY, emptyPersisted, ensureSettingsShape, persistedNeedsCompactionRewrite } from './storageTypes';
import { migrate } from './storageMigrate';
import { recoverInterruptedRestore } from './storageRecovery';

export * from './storageTypes';
export {
  migrate,
  normalizeImportedPersisted,
  isLibraryItemCompleted,
  completedLibraryItems,
  inProgressLibraryItems,
} from './storageMigrate';

export interface StorageTransaction {
  read: () => Promise<PersistedData>;
  write: (data: PersistedData) => Promise<void>;
}

let storageQueue: Promise<void> = Promise.resolve();

/**
 * Serialize background storage reads and mutations, including migration rewrites.
 * All jpPractice writers run in the service worker so they share this queue.
 * Use the supplied read/write functions inside the callback; queued storage calls
 * would wait on themselves. Keep network requests outside the transaction.
 */
export function withStorageTransaction<T>(
  operation: (storage: StorageTransaction) => Promise<T>,
): Promise<T> {
  const result = storageQueue.then(async () => {
    await recoverInterruptedRestore();
    return operation({ read: readPersistedUnlocked, write: writePersisted });
  });
  // A failed operation must reject its caller without blocking later operations.
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function readPersisted(): Promise<PersistedData> {
  return withStorageTransaction(({ read }) => read());
}

async function readPersistedUnlocked(): Promise<PersistedData> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const blob = raw[STORAGE_KEY] as PersistedData | undefined;
  if (!blob) return emptyPersisted();
  const migrated = migrate(blob);
  migrated.settings = ensureSettingsShape(migrated.settings);
  if (persistedNeedsCompactionRewrite(blob)) {
    await writePersisted(migrated);
  }
  return migrated;
}

async function writePersisted(data: PersistedData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}
