import { describe, expect, it } from 'vitest';
import { mergeIncomingDailySnapshot } from './youtubePanelCalendarUi';

describe('mergeIncomingDailySnapshot', () => {
  const todayKey = '2026-06-06';

  it('keeps local today total when remote is stale (pending + stored)', () => {
    const current = { [todayKey]: 935 };
    const incoming = { [todayKey]: 920 };
    const merged = mergeIncomingDailySnapshot(current, incoming, 20, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged[todayKey]).toBe(955);
  });

  it('keeps local today total when remote is stale after optimistic flush', () => {
    const current = { [todayKey]: 950 };
    const incoming = { [todayKey]: 935 };
    const merged = mergeIncomingDailySnapshot(current, incoming, 0, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged[todayKey]).toBe(950);
  });

  it('accepts fresher remote today total', () => {
    const current = { [todayKey]: 935 };
    const incoming = { [todayKey]: 960 };
    const merged = mergeIncomingDailySnapshot(current, incoming, 0, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged[todayKey]).toBe(960);
  });

  it('does not alter past days', () => {
    const current = { '2026-06-05': 600 };
    const incoming = { '2026-06-05': 500, [todayKey]: 100 };
    const merged = mergeIncomingDailySnapshot(current, incoming, 0, Date.parse(`${todayKey}T12:00:00Z`));
    expect(merged['2026-06-05']).toBe(500);
    expect(merged[todayKey]).toBe(100);
  });
});
