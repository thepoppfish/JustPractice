import { describe, expect, it } from 'vitest';
import {
  addVideoDailyPractice,
  normalizeVideoDailySeconds,
  videoHasWatchTime,
  videoPracticeTodaySec,
} from './videoDailyPractice';

describe('videoDailyPractice', () => {
  it('detects any watch time from today, lifetime, or playback', () => {
    const base = {
      videoSeconds: {},
      videoPlaybackPositionSec: {},
      videoDailySeconds: {},
    };
    expect(videoHasWatchTime(base, 'v1', '2026-06-03')).toBe(false);
    expect(
      videoHasWatchTime(
        { ...base, videoDailySeconds: { v1: { '2026-06-03': 30 } } },
        'v1',
        '2026-06-03',
      ),
    ).toBe(true);
    expect(videoHasWatchTime({ ...base, videoSeconds: { v1: 60 } }, 'v1', '2026-06-03')).toBe(
      true,
    );
    expect(
      videoHasWatchTime({ ...base, videoPlaybackPositionSec: { v1: 120 } }, 'v1', '2026-06-03'),
    ).toBe(true);
  });

  it('reads today seconds for a video', () => {
    const data = {
      videoDailySeconds: { v1: { '2026-06-03': 600, '2026-06-02': 120 } },
    };
    expect(videoPracticeTodaySec(data, 'v1', '2026-06-03')).toBe(600);
    expect(videoPracticeTodaySec(data, 'v1', '2026-06-04')).toBe(0);
  });

  it('accumulates into daily buckets', () => {
    let map = addVideoDailyPractice({}, 'v1', '2026-06-03', 100);
    map = addVideoDailyPractice(map, 'v1', '2026-06-03', 50);
    expect(map.v1!['2026-06-03']).toBe(150);
  });

  it('normalizes nested map', () => {
    expect(
      normalizeVideoDailySeconds({
        a: { '2026-06-03': 90, bad: NaN },
        b: 'nope',
      }),
    ).toEqual({ a: { '2026-06-03': 90 } });
  });
});
