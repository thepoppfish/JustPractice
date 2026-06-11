import { describe, expect, it } from 'vitest';
import { signatureOf } from './dataSignature';

describe('signatureOf', () => {
  it('returns equal signatures for deeply equal values', () => {
    const a = { library: [{ id: 'x', n: 1 }], dailySeconds: { '2026-01-01': 60 } };
    const b = { library: [{ id: 'x', n: 1 }], dailySeconds: { '2026-01-01': 60 } };
    expect(signatureOf(a)).toBe(signatureOf(b));
  });

  it('returns different signatures when any field changes', () => {
    const base = { dailySeconds: { '2026-01-01': 60 }, settings: { goalSec: 1800 } };
    const changed = { dailySeconds: { '2026-01-01': 120 }, settings: { goalSec: 1800 } };
    expect(signatureOf(base)).not.toBe(signatureOf(changed));
  });

  it('detects added keys', () => {
    expect(signatureOf({ a: 1 })).not.toBe(signatureOf({ a: 1, b: 2 }));
  });

  it('treats unserializable (circular) values as always-changed', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(signatureOf(circular)).not.toBe(signatureOf(circular));
  });
});
