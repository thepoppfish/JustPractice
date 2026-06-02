/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clampWatchPanelHostToViewport } from './youtubePanelMount';

describe('clampWatchPanelHostToViewport', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    Object.defineProperty(host, 'offsetWidth', { value: 200, configurable: true });
    Object.defineProperty(host, 'offsetHeight', { value: 120, configurable: true });
    host.getBoundingClientRect = () =>
      ({
        width: 200,
        height: 120,
        top: 0,
        left: 0,
        right: 200,
        bottom: 120,
      }) as DOMRect;
    document.body.appendChild(host);
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
  });

  afterEach(() => {
    host.remove();
  });

  it('clamps left/top into the viewport', () => {
    host.style.left = '500px';
    host.style.top = '400px';
    clampWatchPanelHostToViewport(host);
    expect(Number.parseFloat(host.style.left)).toBeLessThanOrEqual(400 - 200 - 8);
    expect(Number.parseFloat(host.style.top)).toBeLessThanOrEqual(300 - 120 - 8);
  });

  it('no-ops when position uses auto', () => {
    host.style.left = 'auto';
    host.style.top = 'auto';
    clampWatchPanelHostToViewport(host);
    expect(host.style.left).toBe('auto');
  });
});
