import { describe, expect, it } from 'vitest';
import { parseContextMenuDifficulty } from './levelTags';

describe('parseContextMenuDifficulty', () => {
  it('parses JLPT CEFR and unrated', () => {
    expect(parseContextMenuDifficulty('jp_root_u')).toBeNull();
    expect(parseContextMenuDifficulty('jp_root_N5')).toBe('N5');
    expect(parseContextMenuDifficulty('jp_root_A1')).toBe('A1');
    expect(parseContextMenuDifficulty('jp_root_C2')).toBe('C2');
  });

  it('parses custom menu indices', () => {
    const levels = ['Easy', 'Hard'];
    expect(parseContextMenuDifficulty('jp_root_x0', levels)).toBe('Easy');
    expect(parseContextMenuDifficulty('jp_root_x1', levels)).toBe('Hard');
    expect(parseContextMenuDifficulty('jp_root_x2', levels)).toBeUndefined();
  });

  it('returns undefined for unknown ids', () => {
    expect(parseContextMenuDifficulty('jp_root_xyz')).toBeUndefined();
    expect(parseContextMenuDifficulty('')).toBeUndefined();
    expect(parseContextMenuDifficulty('other')).toBeUndefined();
  });
});
