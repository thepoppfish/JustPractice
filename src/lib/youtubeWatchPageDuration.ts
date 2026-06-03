/**
 * Parse video length from a YouTube watch-page HTML snapshot.
 * Used by the background worker when backfilling library `durationSec`.
 */
export function parseLengthSecondsFromWatchPageHtml(html: string): number | null {
  if (!html) return null;

  const playerBlock = extractYtInitialPlayerResponseJson(html);
  if (playerBlock) {
    const fromPlayer = parseLengthFromJsonBlob(playerBlock);
    if (fromPlayer !== null) return fromPlayer;
  }

  return parseLengthFromJsonBlob(html);
}

function extractYtInitialPlayerResponseJson(html: string): string | null {
  const marker = 'ytInitialPlayerResponse';
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const brace = html.indexOf('{', idx);
  if (brace < 0) return null;
  return sliceBalancedJson(html, brace);
}

function sliceBalancedJson(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseLengthFromJsonBlob(blob: string): number | null {
  const lengthQuoted = blob.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
  if (lengthQuoted) {
    const sec = Number(lengthQuoted[1]);
    if (isPositiveDuration(sec)) return sec;
  }

  const lengthBare = blob.match(/"lengthSeconds"\s*:\s*(\d+)/);
  if (lengthBare) {
    const sec = Number(lengthBare[1]);
    if (isPositiveDuration(sec)) return sec;
  }

  const approxQuoted = blob.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
  if (approxQuoted) {
    const sec = Math.floor(Number(approxQuoted[1]) / 1000);
    if (isPositiveDuration(sec)) return sec;
  }

  const approxBare = blob.match(/"approxDurationMs"\s*:\s*(\d+)/);
  if (approxBare) {
    const sec = Math.floor(Number(approxBare[1]) / 1000);
    if (isPositiveDuration(sec)) return sec;
  }

  return null;
}

function isPositiveDuration(sec: number): boolean {
  return Number.isFinite(sec) && sec > 0 && sec < 24 * 3600 * 7;
}
