import { describe, expect, it } from 'vitest';
import { formatGoalLiveProgress, formatGoalSlashLive } from './goalFormat';

describe('formatGoalLiveProgress', () => {
  it('counts seconds until 60, then whole minutes', () => {
    expect(formatGoalLiveProgress(0)).toBe('0s');
    expect(formatGoalLiveProgress(1)).toBe('1s');
    expect(formatGoalLiveProgress(59)).toBe('59s');
    expect(formatGoalLiveProgress(60)).toBe('1m');
    expect(formatGoalLiveProgress(119)).toBe('1m');
    expect(formatGoalLiveProgress(120)).toBe('2m');
  });
});

describe('formatGoalSlashLive', () => {
  it('uses live progress for done and minutes-only for target', () => {
    expect(formatGoalSlashLive(45, 1800)).toBe('45s/30m');
    expect(formatGoalSlashLive(90, 1800)).toBe('1m/30m');
  });
});
