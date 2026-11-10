import { expect, it } from 'vitest';
import { createTranslator } from '../i18n';
import { formatPracticeDuration } from './practiceDuration';
it('keeps sub-minute precision and uses whole minutes after the first hour', () => {
  const t = createTranslator('en');
  expect(formatPracticeDuration(59.9, t)).toBe('59 s');
  expect(formatPracticeDuration(65, t)).toBe('1 min 5 s');
  expect(formatPracticeDuration(3600, t)).toBe('1 h');
  expect(formatPracticeDuration(3661, t)).toBe('1 h 1 min');
});
it('handles empty or invalid values without misleading negative or infinite durations', () => {
  for (const seconds of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(formatPracticeDuration(seconds, createTranslator('en'))).toBe('0 min');
  }
});
it('localizes units without changing the accumulated seconds', () => {
  expect(formatPracticeDuration(125, createTranslator('he'))).toBe('2 דק׳ 5 שנ׳');
  expect(formatPracticeDuration(3600, createTranslator('ja'))).toBe('1 時間');
});
