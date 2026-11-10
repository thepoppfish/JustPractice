import { describe, expect, it } from 'vitest';
import { buildMergedDailyForPanel, mergeIncomingDailySnapshot } from './youtubePanelCalendarUi';
import { dateKeyFromTimestamp } from '../lib/storage';

describe('mergeIncomingDailySnapshot', () => {
  const todayKey = '2026-06-06';

  it('keeps the flushed baseline separate from the unflushed playback remainder', () => {
    const current = { [todayKey]: 935 };
    const incoming = { [todayKey]: 920 };
    const merged = mergeIncomingDailySnapshot(current, incoming, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged[todayKey]).toBe(935);
    // Rendering adds the meter's 20 seconds once; they never become stored time.
    expect(merged[todayKey] + 20).toBe(955);
  });

  it('keeps local today total when remote is stale after optimistic flush', () => {
    const current = { [todayKey]: 950 };
    const incoming = { [todayKey]: 935 };
    const merged = mergeIncomingDailySnapshot(current, incoming, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged[todayKey]).toBe(950);
  });

  it('accepts fresher remote today total', () => {
    const current = { [todayKey]: 935 };
    const incoming = { [todayKey]: 960 };
    const merged = mergeIncomingDailySnapshot(current, incoming, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged[todayKey]).toBe(960);
  });

  it('does not alter past days', () => {
    const current = { '2026-06-05': 600 };
    const incoming = { '2026-06-05': 500, [todayKey]: 100 };
    const merged = mergeIncomingDailySnapshot(current, incoming, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged['2026-06-05']).toBe(500);
    expect(merged[todayKey]).toBe(100);
  });

  it('does not inflate the displayed total across repeated polls and a flush', () => {
    const now = Date.now();
    const key = dateKeyFromTimestamp(now);
    let baseline = { [key]: 100 };
    for (const pending of [5, 10, 15, 20]) {
      baseline = mergeIncomingDailySnapshot(baseline, { [key]: 100 }, now);
      const rendered = buildMergedDailyForPanel(baseline, () => baseline[key] + pending);
      expect(rendered[key]).toBe(100 + pending);
      expect(baseline[key]).toBe(100);
    }
    baseline = mergeIncomingDailySnapshot({ [key]: 120 }, { [key]: 120 }, now);
    expect(buildMergedDailyForPanel(baseline, () => baseline[key] + 2)[key]).toBe(122);
  });
});
