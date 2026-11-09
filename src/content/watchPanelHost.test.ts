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

  it('recovers an off-screen default position', () => {
    host.style.left = 'auto';
    host.style.top = 'auto';
    clampWatchPanelHostToViewport(host);
    expect(host.style.left).toBe('8px');
    expect(host.style.top).toBe('8px');
    expect(host.style.bottom).toBe('auto');
  });

  it('preserves an in-bounds default anchor', () => {
    host.style.left = 'auto';
    host.style.top = 'auto';
    host.getBoundingClientRect = () => ({ width: 200, height: 120, left: 16, top: 80 }) as DOMRect;
    clampWatchPanelHostToViewport(host);
    expect(host.style.left).toBe('auto');
    expect(host.style.top).toBe('auto');
  });

  it('moves a saved panel back inside a resized viewport', () => {
    host.style.left = '300px';
    host.style.top = '-127px';
    clampWatchPanelHostToViewport(host);
    expect(host.style.left).toBe('192px');
    expect(host.style.top).toBe('8px');
  });
});
