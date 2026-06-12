/**
 * Guards against shipping user practice data (chrome.storage exports) in store zips.
 */
import path from 'node:path';

/** Dashboard export downloads: justpractice-export-2025-06-12-14-30-00.json */
export const USER_EXPORT_FILENAME_RE =
  /^(justpractice-export|jppractice-export|jp-practice-export)/i;

/**
 * True when JSON text looks like a chrome.storage.local export or jpPractice blob.
 * Only used for .json files — JS bundles legitimately contain the string "jpPractice".
 */
export function looksLikeUserStorageExport(text, filename) {
  if (!filename.endsWith('.json')) return false;
  if (path.basename(filename) === 'manifest.json') return false;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;

  const jp = parsed.jpPractice;
  if (jp && typeof jp === 'object' && !Array.isArray(jp)) {
    if (
      'schemaVersion' in jp &&
      ('library' in jp || 'videoSeconds' in jp || 'settings' in jp || 'playerProgress' in jp)
    ) {
      return true;
    }
  }

  if (
    'schemaVersion' in parsed &&
    ('library' in parsed || 'videoSeconds' in parsed || 'settings' in parsed)
  ) {
    return true;
  }

  return false;
}

/**
 * @param {string} distRel dist-relative path
 * @param {string} content file text
 * @returns {string | null} error message, or null if safe
 */
export function shipFileSafetyIssue(distRel, content) {
  const base = path.basename(distRel);
  if (USER_EXPORT_FILENAME_RE.test(base)) {
    return `export-style filename: ${distRel}`;
  }
  if (looksLikeUserStorageExport(content, distRel)) {
    return `contains practice storage export data: ${distRel}`;
  }
  return null;
}
