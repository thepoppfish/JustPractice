// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachPopupTabs } from './popupTabs';

afterEach(() => { document.body.innerHTML = ''; });

function setup(direction: 'ltr' | 'rtl') {
  const names = ['library', 'stats', 'settings'];
  document.body.innerHTML = `<main>${names.map((name, i) => `
    <button role="tab" data-tab="${name}" aria-controls="panel-${name}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" style="direction:${direction}">${name}</button>
    <section id="panel-${name}" ${i === 0 ? '' : 'hidden'}></section>`).join('')}</main>`;
  const root = document.querySelector('main')!;
  const onChange = vi.fn();
  attachPopupTabs(root, onChange);
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('button')];
  tabs[0].focus();
  return { root, tabs, onChange };
}

describe('popup keyboard tabs', () => {
  it.each(['ltr', 'rtl'] as const)('uses physical arrow direction and wraps in %s', (direction) => {
    const { root, tabs, onChange } = setup(direction);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const selected = direction === 'rtl' ? 2 : 1;
    expect(document.activeElement).toBe(tabs[selected]);
    expect(onChange).toHaveBeenLastCalledWith(tabs[selected].dataset.tab);
    expect(tabs.map(t => t.tabIndex)).toEqual(tabs.map((_, i) => i === selected ? 0 : -1));
    expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(root.querySelector(`#panel-${tabs[selected].dataset.tab}`)?.hasAttribute('hidden')).toBe(false);
    tabs[selected].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('supports Home/End and leaves Tab to the browser', () => {
    const { tabs } = setup('ltr');
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(tabs[2]);
    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(tabs[0]);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    tabs[0].dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('updates selected semantics and hides inactive panels after a click', () => {
    const { root, tabs } = setup('ltr');
    tabs[2].click();
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#panel-library')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('#panel-settings')?.hasAttribute('hidden')).toBe(false);
  });
});
