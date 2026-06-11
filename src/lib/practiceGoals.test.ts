import { describe, expect, it } from 'vitest';
import { goalsFromDailyMinutes, parseDailyGoalMinutesInput } from './practiceGoals';

describe('goalsFromDailyMinutes', () => {
  it('returns null targets when minutes are empty or zero', () => {
    expect(goalsFromDailyMinutes(null)).toEqual({
      dailyTargetSec: null,
      weeklyTargetSec: null,
      monthlyTargetSec: null,
    });
    expect(goalsFromDailyMinutes(0)).toEqual({
      dailyTargetSec: null,
      weeklyTargetSec: null,
      monthlyTargetSec: null,
    });
  });

  it('derives weekly and monthly from daily minutes', () => {
    const atMs = new Date(2026, 0, 15).getTime(); // January = 31 days
    expect(goalsFromDailyMinutes(30, atMs)).toEqual({
      dailyTargetSec: 1800,
      weeklyTargetSec: 1800 * 7,
      monthlyTargetSec: 1800 * 31,
    });
  });
});

describe('parseDailyGoalMinutesInput', () => {
  it('parses valid minutes and caps at 180', () => {
    expect(parseDailyGoalMinutesInput('30')).toBe(30);
    expect(parseDailyGoalMinutesInput(' 45 ')).toBe(45);
    expect(parseDailyGoalMinutesInput('999')).toBe(180);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseDailyGoalMinutesInput('')).toBeNull();
    expect(parseDailyGoalMinutesInput('abc')).toBeNull();
  });
});
