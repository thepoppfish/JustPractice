// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { watchPanelShadowInnerHtml } from './youtubePanelHtml';
import { attachPanelDrag, updateDailyGoalRing } from './youtubePanelUi';

it('moves the panel with physical arrow keys, supports Shift and clamps to the viewport', () => {
  const host = document.createElement('div');
  const handle = document.createElement('button');
  host.style.left = '100px';
  host.style.top = '50px';
  Object.defineProperties(host, { offsetWidth: { value: 300 }, offsetHeight: { value: 300 } });
  host.getBoundingClientRect = () => ({ left: parseFloat(host.style.left), top: parseFloat(host.style.top) }) as DOMRect;
  const commit = vi.fn();
  attachPanelDrag(host, handle, commit);
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
  expect(commit).toHaveBeenLastCalledWith(90, 50);
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, cancelable: true }));
  expect(commit).toHaveBeenLastCalledWith(90, 10);
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, cancelable: true }));
  expect(commit).toHaveBeenLastCalledWith(90, 8);
  expect(host.style.bottom).toBe('auto');
});

it('exposes a localized goal summary after loading, including the no-goal state', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = watchPanelShadowInnerHtml('', {
    dragToMove: 'Move', level: 'Level', saveToLibrary: 'Save', markComplete: 'Complete', markIncomplete: 'Incomplete',
  });
  const ring = shadowRoot.querySelector('[part="daily-goal-ring"]')!;
  expect(ring.getAttribute('aria-hidden')).toBe('true');
  const options = { shadowRoot, getTodayPracticeSeconds: () => 60, panelT: createTranslator('he') };
  updateDailyGoalRing({ ...options, getGoals: () => ({ dailyTargetSec: 120, weeklyTargetSec: null, monthlyTargetSec: null }) });
  expect(ring.hasAttribute('aria-hidden')).toBe(false);
  expect(ring.getAttribute('aria-label')).toContain('50%');
  updateDailyGoalRing({ ...options, getGoals: () => ({ dailyTargetSec: null, weeklyTargetSec: null, monthlyTargetSec: null }) });
  expect(ring.getAttribute('aria-label')).toBe(createTranslator('he')('panel.dailyGoalNoTarget'));
});
