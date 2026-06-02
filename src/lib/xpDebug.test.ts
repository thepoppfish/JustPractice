import { describe, expect, it } from 'vitest';
import { explainPracticeXpZero } from './xpDebug';

describe('explainPracticeXpZero', () => {
  it('describes carry banking when no XP awarded', () => {
    expect(
      explainPracticeXpZero({ deltaSeconds: 15, carryIn: 30, carryOut: 45, xpGained: 0 }),
    ).toContain('banking 45s');
  });

  it('returns empty when XP was gained', () => {
    expect(explainPracticeXpZero({ deltaSeconds: 15, carryIn: 45, carryOut: 0, xpGained: 1 })).toBe(
      '',
    );
  });
});
