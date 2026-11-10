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

it('keeps a failed Undo visible when a delayed synchronization returns the same offer', async () => {
  const offer = { token: 'same-removal', title: 'Practice fixture', expiresAt: Date.now() + 86400000 };
  let rejectWrite!: (error: Error) => void;
  const sendMessage = vi.fn((message: { type: string }) => message.type === MSG.UNDO_LIBRARY_REMOVAL
    ? new Promise((_resolve, reject) => { rejectWrite = reject; })
    : Promise.resolve({ ok: true, undo: offer }));
  vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } });
  document.body.innerHTML = '<main></main>';
  const root = document.querySelector('main')!;
  const ui = libraryUndoUi(root, createTranslator('en'), async () => {});
  await vi.waitFor(() => expect(document.querySelector<HTMLElement>('.jp-library-undo')!.hidden).toBe(false));
  document.querySelector<HTMLButtonElement>('[data-undo-removal]')!.click();
  await vi.waitFor(() => expect(typeof rejectWrite).toBe('function'));
  await ui.refresh(); // A storage notification is queued while the Undo write is pending.
  rejectWrite(new Error('QUOTA_BYTES quota exceeded'));
  await vi.waitFor(() => expect(sendMessage.mock.calls.filter(([m]) => m.type === MSG.GET_LIBRARY_UNDO)).toHaveLength(2));
  await vi.waitFor(() => {
    const error = document.querySelector<HTMLElement>('.jp-library-undo-error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Could not undo');
    expect(document.querySelector<HTMLButtonElement>('[data-undo-removal]')!.disabled).toBe(false);
  });
});
