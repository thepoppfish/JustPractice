export interface PracticeViewState {
  visibilityState: DocumentVisibilityState;
  documentFocused: boolean;
  pauseWhenUnfocused: boolean;
}

/** Hidden tabs never count. The optional focus gate also pauses visible inactive windows. */
export function practiceViewBlockReason(state: PracticeViewState): 'hidden' | 'unfocused' | null {
  if (state.visibilityState !== 'visible') return 'hidden';
  if (state.pauseWhenUnfocused && !state.documentFocused) return 'unfocused';
  return null;
}
