// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { attachPracticePageFlushListeners } from './youtubePracticeTimer';

describe('practice page eligibility boundaries', () => {
  it('rechecks before flushing on blur/hide and rechecks again on focus/show', () => {
    const events: string[] = [];
    let visibility: DocumentVisibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    attachPracticePageFlushListeners({
      onEligibilityChange: () => events.push('recheck'),
      flush: () => events.push('flush'),
    });

    window.dispatchEvent(new Event('blur'));
    expect(events.splice(0)).toEqual(['recheck', 'flush']);
    window.dispatchEvent(new Event('focus'));
    expect(events.splice(0)).toEqual(['recheck']);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(events.splice(0)).toEqual(['recheck', 'flush']);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(events.splice(0)).toEqual(['recheck']);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload'));
    expect(events).toEqual(['flush', 'flush']);
    vi.restoreAllMocks();
  });
});
