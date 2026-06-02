import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_SYNC_INTERVAL_MS, startStorageSyncPoll } from './storageSyncPoll';

describe('startStorageSyncPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { visibilityState: 'visible' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fires onTick every intervalMs', () => {
    const onTick = vi.fn();
    startStorageSyncPoll(onTick, { intervalMs: 1000 });
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('uses STORAGE_SYNC_INTERVAL_MS by default', () => {
    const onTick = vi.fn();
    startStorageSyncPoll(onTick);
    vi.advanceTimersByTime(STORAGE_SYNC_INTERVAL_MS - 1);
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('skips tick when document is hidden and whenVisible is true', () => {
    const onTick = vi.fn();
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    startStorageSyncPoll(onTick, { intervalMs: 1000, whenVisible: true });
    vi.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('still ticks when hidden if whenVisible is false', () => {
    const onTick = vi.fn();
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    startStorageSyncPoll(onTick, { intervalMs: 1000, whenVisible: false });
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('stop clears the interval', () => {
    const onTick = vi.fn();
    const stop = startStorageSyncPoll(onTick, { intervalMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    stop();
    vi.advanceTimersByTime(5000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
