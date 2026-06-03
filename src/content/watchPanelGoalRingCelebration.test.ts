import { describe, expect, it } from 'vitest';
import { buildBurstParticleSpecs } from './watchPanelGoalRingCelebration';

describe('buildBurstParticleSpecs', () => {
  it('returns evenly spaced angles', () => {
    const specs = buildBurstParticleSpecs(4);
    expect(specs).toHaveLength(4);
    expect(specs[0].angle).toBeCloseTo(0);
    expect(specs[1].angle).toBeCloseTo(Math.PI / 2);
    expect(specs[2].angle).toBeCloseTo(Math.PI);
    expect(specs[3].angle).toBeCloseTo((3 * Math.PI) / 2);
  });
});
