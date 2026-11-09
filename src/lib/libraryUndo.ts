/** Ephemeral undo metadata is kept out of persistent practice exports. */
export const LIBRARY_UNDO_KEY = 'jpLibraryUndo';
export interface LibraryUndoOffer {
  token: string;
  title: string;
  expiresAt: number;
}
