/** Restore an identified control only if a DOM replacement removed the user's focus. */
export function rememberUiFocus(root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  const previous = doc.activeElement;
  if (!(previous instanceof HTMLElement) || !root.contains(previous)) return () => {};
  const id = previous.id;
  const view = previous.matches('h2') ? previous.closest<HTMLElement>('[data-view-panel]')?.dataset.viewPanel : null;
  const selection = previous instanceof HTMLInputElement || previous instanceof HTMLTextAreaElement
    ? [previous.selectionStart, previous.selectionEnd] as const : null;
  return () => {
    // Leave retained controls, and any newer deliberate focus, alone.
    if (previous.isConnected || (doc.activeElement !== doc.body && root.contains(doc.activeElement))) return;
    const next = id ? doc.getElementById(id) : view ? root.querySelector<HTMLElement>(`[data-view-panel="${view}"] h2`) : null;
    if (!next || !root.contains(next) || next.closest('[hidden], .view--hidden')) return;
    if (next.matches('h2')) next.tabIndex = -1;
    next.focus({ preventScroll: true });
    if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) && selection?.[0] != null) {
      next.setSelectionRange(selection[0], selection[1]);
    }
  };
}
