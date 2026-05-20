import type { AppSettings, LevelTag, PersistedData } from './storage';

export const MSG = {
  GET_STATE: 'GET_STATE',
  ADD_OR_UPDATE_LIBRARY: 'ADD_OR_UPDATE_LIBRARY',
  REMOVE_LIBRARY: 'REMOVE_LIBRARY',
  SET_DIFFICULTY: 'SET_DIFFICULTY',
  SET_LIBRARY_COMPLETION: 'SET_LIBRARY_COMPLETION',
  PRACTICE_TICK: 'PRACTICE_TICK',
  SET_SETTINGS: 'SET_SETTINGS',
  ENRICH_LIBRARY_META: 'ENRICH_LIBRARY_META',
  CLEAR_ALL_EXTENSION_DATA: 'CLEAR_ALL_EXTENSION_DATA',
  RESTORE_EXTENSION_STORAGE: 'RESTORE_EXTENSION_STORAGE',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface GetStateMessage {
  type: typeof MSG.GET_STATE;
}

export interface AddOrUpdateLibraryMessage {
  type: typeof MSG.ADD_OR_UPDATE_LIBRARY;
  payload: {
    videoId: string;
    title: string;
    channel: string;
    difficulty?: LevelTag | null;
  };
}

export interface RemoveLibraryMessage {
  type: typeof MSG.REMOVE_LIBRARY;
  payload: { videoId: string };
}

export interface SetDifficultyMessage {
  type: typeof MSG.SET_DIFFICULTY;
  payload: { videoId: string; difficulty: LevelTag | null };
}

export interface SetLibraryCompletionMessage {
  type: typeof MSG.SET_LIBRARY_COMPLETION;
  payload: {
    videoId: string;
    complete: boolean;
    /** Used when upserting a library row that does not exist yet. */
    title?: string;
    channel?: string;
  };
}

/** Delta seconds accumulated on the client while practice rules held */
export interface PracticeTickMessage {
  type: typeof MSG.PRACTICE_TICK;
  payload: {
    videoId: string;
    deltaSeconds: number;
    /** Client clock ms when tick ended (for date bucket) */
    endedAtMs: number;
  };
}

export interface SetSettingsMessage {
  type: typeof MSG.SET_SETTINGS;
  payload: Partial<AppSettings>;
}

export interface EnrichLibraryMetaMessage {
  type: typeof MSG.ENRICH_LIBRARY_META;
  payload: { videoId: string };
}

export interface ClearAllExtensionDataMessage {
  type: typeof MSG.CLEAR_ALL_EXTENSION_DATA;
}

/** Full `chrome.storage.local` snapshot (same shape as Export JSON). */
export interface RestoreExtensionStorageMessage {
  type: typeof MSG.RESTORE_EXTENSION_STORAGE;
  payload: Record<string, unknown>;
}

export type ExtensionMessage =
  | GetStateMessage
  | AddOrUpdateLibraryMessage
  | RemoveLibraryMessage
  | SetDifficultyMessage
  | SetLibraryCompletionMessage
  | PracticeTickMessage
  | SetSettingsMessage
  | EnrichLibraryMetaMessage
  | ClearAllExtensionDataMessage
  | RestoreExtensionStorageMessage;

export interface GetStateResponse {
  ok: true;
  data: PersistedData;
}

export interface OkResponse {
  ok: true;
}

/** Returned for {@link MSG.ADD_OR_UPDATE_LIBRARY} so the UI can tell a new save from an update. */
export interface LibraryWriteOkResponse {
  ok: true;
  libraryAction: 'inserted' | 'updated';
  title: string;
  channel: string;
  difficulty: LevelTag | null;
}

export type ExtensionResponse =
  | GetStateResponse
  | OkResponse
  | LibraryWriteOkResponse
  | { ok: false; error: string };
