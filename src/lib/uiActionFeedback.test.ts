// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { MSG } from './messages';
import { uiActionFeedback } from './uiActionFeedback';

let root: HTMLElement;
const t = createTranslator('en');
const markup = '<div class="settings-block"><input id="name" value="Saved"><button id="save" type="button">Save</button></div><input id="goal" value="30">';
beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = `<main id="app">${markup}</main>`; root = document.getElementById('app')!; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); document.body.innerHTML = ''; });
const input = () => root.querySelector<HTMLInputElement>('#name')!;
const button = () => root.querySelector<HTMLButtonElement>('#save')!;

describe('mutation feedback and unsaved controls', () => {
  it('stops after rejected writes and preserves an edited field through a storage paint', async () => {
    const actions = uiActionFeedback(root, t);
    const send = actions.sender(vi.fn().mockResolvedValue({ ok: false, error: 'Quota exceeded' }));
    const afterWrite = vi.fn();
    input().value = 'Unsaved name';
    const done = await actions.run(button(), async () => {
      await send({ type: MSG.SET_SETTINGS, payload: { displayName: input().value } });
      afterWrite();
    }, vi.fn());
    expect(done).toBe(false);
    expect(afterWrite).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Storage is full');
    root.innerHTML = markup;
    actions.restore();
    expect(input().value).toBe('Unsaved name');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('disables conflicting controls while pending, refuses duplicate actions, then restores focus', async () => {
    const actions = uiActionFeedback(root, t);
    let finish!: (value: unknown) => void;
    const transport = vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const send = actions.sender(transport);
    button().focus();
    const pending = actions.run(button(), async () => { await send({ type: MSG.SET_SETTINGS, payload: { displayName: 'Name' } }); }, vi.fn());
    expect(input().disabled).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(document.querySelector<HTMLElement>('.jp-action-status')?.dataset.state).toBe('working');
    expect(await actions.run(button(), async () => { await send({ type: MSG.SET_SETTINGS, payload: {} }); }, vi.fn())).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await pending;
    expect(input().disabled).toBe(false);
    expect(document.activeElement).toBe(button());
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Changes saved.');
    expect(document.querySelector<HTMLElement>('.jp-action-status')?.dataset.state).toBe('success');
  });

  it('keeps a different unsaved edit when a successful action paints new saved values', async () => {
    const actions = uiActionFeedback(root, t);
    input().value = 'Still editing';
    const goal = root.querySelector<HTMLInputElement>('#goal')!;
    goal.value = '45';
    await actions.run(button(), async () => {
      root.innerHTML = markup.replace('value="30"', 'value="45"');
      actions.restore();
    }, vi.fn());
    expect(input().value).toBe('Still editing');
    expect(root.querySelector<HTMLInputElement>('#goal')?.value).toBe('45');
  });

  it('does not treat an acknowledged checkbox as a draft that overrides a later external change', async () => {
    root.innerHTML = '<input id="focus" type="checkbox" checked>';
    const actions = uiActionFeedback(root, t);
    const control = root.querySelector<HTMLInputElement>('#focus')!;
    control.checked = false;
    const send = actions.sender(vi.fn().mockResolvedValue({ ok: true }));
    await actions.run(control, async () => { await send({ type: MSG.SET_SETTINGS, payload: { pauseWhenUnfocused: false } }); }, vi.fn());
    actions.captureDrafts();
    root.innerHTML = '<input id="focus" type="checkbox" checked>';
    actions.restore();
    expect(root.querySelector<HTMLInputElement>('#focus')!.checked).toBe(true);
  });

  it('releases a button’s committed draft before painting normalized server values', async () => {
    button().dataset.commitControls = 'name';
    const actions = uiActionFeedback(root, t);
    input().value = '  New name  ';
    const send = actions.sender(vi.fn().mockResolvedValue({ ok: true }));
    await actions.run(button(), async () => {
      await send({ type: MSG.SET_SETTINGS, payload: { displayName: input().value } });
      actions.captureDrafts();
      root.innerHTML = markup.replace('value="Saved"', 'value="New name"');
      actions.restore();
    }, vi.fn());
    expect(input().value).toBe('New name');
  });

  it('retries through the current control after a paint and reads the latest retained value', async () => {
    const actions = uiActionFeedback(root, t);
    const transport = vi.fn().mockResolvedValueOnce({ ok: false, error: 'Rejected' }).mockResolvedValue({ ok: true });
    const send = actions.sender(transport);
    const bind = () => button().addEventListener('click', (event) => actions.handle(event, async () => {
      await send({ type: MSG.SET_SETTINGS, payload: { displayName: input().value } });
    }));
    input().value = 'First edit'; bind(); button().click();
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')).not.toBeNull());
    root.innerHTML = markup; actions.restore(); bind(); input().value = 'Latest edit';
    root.querySelector<HTMLButtonElement>('.jp-action-error button')!.click();
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    expect(transport.mock.calls[1][0].payload.displayName).toBe('Latest edit');
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')).toBeNull());
  });

  it('retains the field and gives refresh guidance for an invalidated extension', async () => {
    const actions = uiActionFeedback(root, createTranslator('he'));
    input().value = 'השם שלי';
    await actions.run(button(), async () => { throw new Error('Extension context invalidated'); }, vi.fn());
    expect(input().value).toBe('השם שלי');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('לפני רענון הדף');
    expect(root.querySelector('.jp-action-error button')?.textContent).toBe('ניסיון נוסף');
  });

  it('does not dismiss a failed field’s retry control for a keyboard event that saves nothing', async () => {
    const actions = uiActionFeedback(root, t);
    await actions.run(input(), async () => { throw new Error('Quota exceeded'); }, vi.fn());
    await actions.run(input(), () => {}, vi.fn());
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('does not restore old-profile drafts or late errors after an explicit clear/restore', async () => {
    const actions = uiActionFeedback(root, t);
    input().value = 'Previous profile';
    let reject!: (error: Error) => void;
    const pending = actions.run(button(), () => new Promise<void>((_, fail) => { reject = fail; }), vi.fn());
    actions.reset(); root.innerHTML = markup;
    reject(new Error('Late failure'));
    await pending;
    expect(input().value).toBe('Saved');
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });
});

it('opens an advanced disclosure if a pending edit fails after the user closes it', async () => {
  root.innerHTML = '<details id="advanced" open><summary>Advanced</summary>'+markup+'</details>';
  const actions = uiActionFeedback(root, t);
  await actions.run(button(), async () => {
    root.querySelector('details')!.open = false;
    throw new Error('Storage unavailable');
  }, vi.fn());
  expect(root.querySelector('details')!.open).toBe(true);
  expect(root.querySelector('[role="alert"]')).not.toBeNull();
});
