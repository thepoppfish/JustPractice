/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEARNING_FOCUS_HIDE_SELECTORS,
  LEARNING_FOCUS_ROOT_CLASS,
  learningFocusModeCss,
  shouldApplyLearningFocusMode,
  syncLearningFocusMode,
} from './learningFocusMode';

describe('learningFocusMode', () => {
  beforeEach(() => {
    document.documentElement.classList.remove(LEARNING_FOCUS_ROOT_CLASS);
    document.getElementById('jp-learning-focus-styles')?.remove();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      writable: true,
    });
  });

  it('requires setting, library, and classic watch page', () => {
    expect(
      shouldApplyLearningFocusMode({ settingEnabled: true, inLibrary: true }),
    ).toBe(true);
    expect(
      shouldApplyLearningFocusMode({ settingEnabled: false, inLibrary: true }),
    ).toBe(false);
    expect(
      shouldApplyLearningFocusMode({ settingEnabled: true, inLibrary: false }),
    ).toBe(false);
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
      writable: true,
    });
    expect(
      shouldApplyLearningFocusMode({ settingEnabled: true, inLibrary: true }),
    ).toBe(false);
  });

  it('includes current YouTube recommendation selectors in injected CSS', () => {
    const css = learningFocusModeCss();
    expect(css).toContain('ytd-watch-next-secondary-results-renderer');
    expect(css).toContain('#secondary');
    expect(LEARNING_FOCUS_HIDE_SELECTORS.length).toBeGreaterThan(2);
  });

  it('toggles root class on sync', () => {
    syncLearningFocusMode({ settingEnabled: true, inLibrary: true });
    expect(document.documentElement.classList.contains(LEARNING_FOCUS_ROOT_CLASS)).toBe(
      true,
    );
    syncLearningFocusMode({ settingEnabled: true, inLibrary: false });
    expect(document.documentElement.classList.contains(LEARNING_FOCUS_ROOT_CLASS)).toBe(
      false,
    );
  });

  it('hides recommendation nodes directly when active', () => {
    const rec = document.createElement('ytd-watch-next-secondary-results-renderer');
    document.body.appendChild(rec);
    syncLearningFocusMode({ settingEnabled: true, inLibrary: true });
    expect(rec.style.display).toBe('none');
    syncLearningFocusMode({ settingEnabled: true, inLibrary: false });
    expect(rec.style.display).toBe('');
    rec.remove();
  });
});
