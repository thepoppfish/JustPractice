import type { LevelFramework, LevelTag } from './storage';
import { CEFR_LEVELS, JLPT_LEVELS } from './storage';

/** Tags shown in UI for the chosen framework only (not Unrated). */
export function tagsForFramework(
  framework: LevelFramework,
  customLevels: readonly string[] = [],
): readonly string[] {
  if (framework === 'jlpt') return JLPT_LEVELS;
  if (framework === 'cefr') return CEFR_LEVELS;
  return customLevels;
}

export function isJlptTag(tag: string | null | undefined): boolean {
  return typeof tag === 'string' && (JLPT_LEVELS as readonly string[]).includes(tag);
}

export function isCefrTag(tag: string | null | undefined): boolean {
  return typeof tag === 'string' && (CEFR_LEVELS as readonly string[]).includes(tag);
}

/** Tagged with levels outside the active framework’s primary list. */
export function isLegacyLevelTag(
  tag: LevelTag | null,
  activeFramework: LevelFramework,
  customLevels: readonly string[] = [],
): boolean {
  if (tag === null) return false;
  if (activeFramework === 'jlpt') return !isJlptTag(tag);
  if (activeFramework === 'cefr') return !isCefrTag(tag);
  return !customLevels.includes(tag);
}

/** `tag` belongs to `activeFramework` (not unrated). */
export function matchesActiveFramework(
  tag: LevelTag | null,
  activeFramework: LevelFramework,
  customLevels: readonly string[] = [],
): boolean {
  if (tag === null) return false;
  if (activeFramework === 'jlpt') return isJlptTag(tag);
  if (activeFramework === 'cefr') return isCefrTag(tag);
  return customLevels.includes(tag);
}

/** Display order labels for bars: active framework ascending difficulty + optional legacy bucket label is handled in practiceStats */
export function levelBucketOrder(
  activeFramework: LevelFramework,
  customLevels: readonly string[] = [],
): readonly string[] {
  if (activeFramework === 'jlpt') return ['Unrated', ...JLPT_LEVELS, 'Legacy'];
  if (activeFramework === 'cefr') return ['Unrated', ...CEFR_LEVELS, 'Legacy'];
  return ['Unrated', ...customLevels, 'Legacy'];
}

const BUILTIN_MENU_RE = /^jp_root_(u|N5|N4|N3|N2|N1|A1|A2|B1|B2|C1|C2)$/;
const CUSTOM_MENU_RE = /^jp_root_x(\d+)$/;

/** Parse Chrome context menu id into unrated (= null) or a level tag. */
export function parseContextMenuDifficulty(
  menuItemId: string,
  customLevels: readonly string[] = [],
): LevelTag | null | undefined {
  const b = menuItemId.match(BUILTIN_MENU_RE);
  if (b) {
    if (b[1] === 'u') return null;
    const code = b[1];
    if ((JLPT_LEVELS as readonly string[]).includes(code) || (CEFR_LEVELS as readonly string[]).includes(code)) {
      return code;
    }
    return undefined;
  }
  const c = menuItemId.match(CUSTOM_MENU_RE);
  if (c) {
    const idx = Number(c[1]);
    if (!Number.isInteger(idx) || idx < 0 || idx >= customLevels.length) return undefined;
    return customLevels[idx];
  }
  return undefined;
}
