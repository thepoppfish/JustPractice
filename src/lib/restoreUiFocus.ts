/** Restore an identified control only if a DOM replacement removed the user's focus. */
export function rememberUiFocus(root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  const previous = doc.activeElement;
  const disclosures = [...root.querySelectorAll<HTMLDetailsElement>('details[id]')].map((el) => ({ id: el.id, open: el.open }));
  const hadFocus = previous instanceof HTMLElement && root.contains(previous);
  const id = hadFocus ? previous.id : '';
  const view = hadFocus && previous.matches('h2') ? previous.closest<HTMLElement>('[data-view-panel]')?.dataset.viewPanel : null;
  const selection = previous instanceof HTMLInputElement || previous instanceof HTMLTextAreaElement
    ? [previous.selectionStart, previous.selectionEnd] as const : null;
  return () => {
    for (const { id, open } of disclosures) {
      const next = doc.getElementById(id);
      if (next instanceof HTMLDetailsElement && root.contains(next)) next.open = open;
    }
    if (!hadFocus) return;
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
