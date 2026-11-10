import { afterEach, describe, expect, it, vi } from 'vitest';
import { MSG } from './messages';
import { requireOkResponse, sendChecked } from './extensionMessaging';

afterEach(() => vi.unstubAllGlobals());

describe('checked extension messages', () => {
  it.each([undefined, null, {}, { ok: false, error: 'Quota exceeded' }, { ok: 'true' }])(
    'rejects an unsuccessful or malformed response: %j', (response) => {
      expect(() => requireOkResponse(response)).toThrow();
    },
  );

  it('preserves successful response fields', () => {
    const response = { ok: true, data: { library: [] } };
    expect(requireOkResponse(response)).toBe(response);
  });

  it('rejects a disconnected worker instead of inventing a successful response', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockRejectedValue(new Error('Extension context invalidated')) } });
    await expect(sendChecked({ type: MSG.GET_STATE })).rejects.toThrow('Extension context invalidated');
  });
});
