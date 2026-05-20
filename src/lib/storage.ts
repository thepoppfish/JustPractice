import type { PersistedData } from './storageTypes';
import { STORAGE_KEY, emptyPersisted, ensureSettingsShape, persistedNeedsCompactionRewrite } from './storageTypes';
import { migrate, normalizeImportedPersisted } from './storageMigrate';

export * from './storageTypes';
export {
  migrate,
  normalizeImportedPersisted,
  isLibraryItemCompleted,
  completedLibraryItems,
  inProgressLibraryItems,
} from './storageMigrate';

export async function readPersisted(): Promise<PersistedData> {
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

export async function writePersisted(data: PersistedData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}
