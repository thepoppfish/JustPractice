// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { rememberUiFocus } from './restoreUiFocus';

afterEach(() => { document.body.innerHTML = ''; });

it('preserves native disclosure state and summary focus through a storage repaint', () => {
  document.body.innerHTML = '<main><details id="actions" open><summary id="summary">More</summary><button>Remove</button></details></main>';
  const root = document.querySelector('main')!;
  root.querySelector<HTMLElement>('summary')!.focus();
  const restore = rememberUiFocus(root);
  root.innerHTML = '<details id="actions"><summary id="summary">More</summary><button>Remove</button></details>';
  restore();
  expect(root.querySelector('details')!.open).toBe(true);
  expect(document.activeElement?.id).toBe('summary');
});

it('restores a replaced search control and caret, without overriding newer focus', () => {
  document.body.innerHTML = '<main><input id="search" type="search" value="practice"><button id="next">Next</button></main>';
  const root = document.querySelector('main')!;
  const search = document.querySelector<HTMLInputElement>('#search')!;
  search.focus();
  search.setSelectionRange(3, 5);
  const restore = rememberUiFocus(root);
  root.innerHTML = '<input id="search" type="search" value="practice"><button id="next">Next</button>';
  restore();
  expect(document.activeElement?.id).toBe('search');
  expect((document.activeElement as HTMLInputElement).selectionStart).toBe(3);
  const restoreAgain = rememberUiFocus(root);
  root.innerHTML = '<input id="search" type="search" value="practice"><button id="next">Next</button>';
  document.querySelector<HTMLButtonElement>('#next')!.focus();
  restoreAgain();
  expect(document.activeElement?.id).toBe('next');
});

it('restores section-heading focus after refresh and skips hidden controls', () => {
  document.body.innerHTML = '<main><section data-view-panel="path"><h2 tabindex="-1">Roadmap</h2></section></main>';
  const root = document.querySelector('main')!;
  document.querySelector<HTMLElement>('h2')!.focus();
  const restore = rememberUiFocus(root);
  root.innerHTML = '<section data-view-panel="path"><h2>Roadmap</h2></section>';
  restore();
  expect(document.activeElement).toBe(root.querySelector('h2'));
  root.innerHTML = '<input id="setting">';
  root.querySelector<HTMLInputElement>('input')!.focus();
  const restoreHidden = rememberUiFocus(root);
  root.innerHTML = '<div hidden><input id="setting"></div>';
  restoreHidden();
  expect(document.activeElement).toBe(document.body);
});
