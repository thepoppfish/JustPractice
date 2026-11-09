// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { startHelloCarousel } from './welcomeHelloAnimation';

it('keeps the greeting static when reduced motion is requested', () => {
  vi.useFakeTimers();
  const helloEl = document.createElement('p');
  const labelEl = document.createElement('p');
  const onIndexChange = vi.fn();
  const carousel = startHelloCarousel({ helloEl, labelEl, reducedMotion: true, onIndexChange });
  const initial = helloEl.textContent;
  vi.advanceTimersByTime(20_000);
  expect(helloEl.textContent).toBe(initial);
  expect(onIndexChange).toHaveBeenCalledTimes(1);
  carousel.stop();
  vi.useRealTimers();
});
