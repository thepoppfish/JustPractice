import { describe, expect, it } from 'vitest';
import { buildConnectorBezierPath } from './dashboardPathLayout';

describe('buildConnectorBezierPath', () => {
  it('returns a cubic path between two points', () => {
    const d = buildConnectorBezierPath({ x: 40, y: 50 }, { x: 200, y: 180 });
    expect(d).toMatch(/^M 40 50 C /);
    expect(d).toMatch(/200 180$/);
  });
});
