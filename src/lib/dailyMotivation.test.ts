import { describe, expect, it } from 'vitest';
import { createTranslator, resolveLocale } from '../i18n';
import { dailyMotivationForToday } from './dailyMotivation';

describe('dailyMotivationForToday', () => {
  const t = createTranslator(resolveLocale('en'));

  it('returns the same message for the same local day', () => {
    const ms = Date.parse('2026-05-19T10:00:00');
    const a = dailyMotivationForToday([], t, ms);
    const b = dailyMotivationForToday([], t, ms + 3_600_000);
    expect(a).toBe(b);
    expect(a).toBeTruthy();
  });

  it('includes custom messages in the pool', () => {
    const custom = ['My test line only here'];
    const ms = Date.parse('2026-01-01T12:00:00');
    let hit = false;
    for (let d = 1; d <= 400; d++) {
      const msg = dailyMotivationForToday(custom, t, Date.parse(`2026-02-${String(d).padStart(2, '0')}T12:00:00`));
      if (msg === custom[0]) hit = true;
    }
    expect(hit).toBe(true);
  });

  it('returns null when built-in and custom pools are empty', () => {
    const emptyT = () => '';
    expect(dailyMotivationForToday([], emptyT as typeof t)).toBeNull();
  });
});
