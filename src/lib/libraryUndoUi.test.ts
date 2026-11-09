// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { MSG } from './messages';
import { libraryUndoUi } from './libraryUndoUi';
import { uiActionFeedback } from './uiActionFeedback';
afterEach(() => { window.dispatchEvent(new Event('pagehide')); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
it('holds Undo disabled until its parent removal settles, then transfers focus and accepts one undo', async () => {
  const sendMessage = vi.fn(async (message: { type: string }) => message.type === MSG.GET_LIBRARY_UNDO ? { ok: true, undo: null } : { ok: true });
  vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } });
  document.body.innerHTML = '<main><button id="remove">Remove</button></main>';
  const root = document.querySelector('main')!;
  const remove = root.querySelector('button')!;
  const t = createTranslator('en');
  const actions = uiActionFeedback(root, t);
  const changed = vi.fn(async () => {});
  const ui = libraryUndoUi(root, t, changed);
  let finish!: () => void;
  const pending = actions.run(remove, async () => {
    ui.removed({ token: 'removal-token', title: 'Practice fixture', expiresAt: Date.now() + 86400000 });
    await new Promise<void>((resolve) => { finish = resolve; });
  }, () => {});
  const undo = document.querySelector<HTMLButtonElement>('[data-undo-removal]')!;
  expect(undo.disabled).toBe(true);
  undo.click();
  expect(sendMessage.mock.calls.filter(([m]) => m.type === MSG.UNDO_LIBRARY_REMOVAL)).toHaveLength(0);
  finish();
  await pending;
  await vi.waitFor(() => { expect(undo.disabled).toBe(false); expect(document.activeElement).toBe(undo); });
  undo.click();
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(sendMessage.mock.calls.filter(([m]) => m.type === MSG.UNDO_LIBRARY_REMOVAL)).toHaveLength(1);
  await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-dismiss-undo]')));
});
