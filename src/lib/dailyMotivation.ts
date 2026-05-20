import type { Translator } from '../i18n';
import { dateKeyFromTimestamp } from './storage';

const BUILTIN_MESSAGE_COUNT = 15;

function stableIndexForDateKey(dateKey: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash % poolSize;
}

/** One motivational line for the local calendar day (built-in i18n + user custom lines). */
export function dailyMotivationForToday(
  customMessages: readonly string[],
  t: Translator,
  nowMs = Date.now(),
): string | null {
  const pool: string[] = [];
  for (let i = 1; i <= BUILTIN_MESSAGE_COUNT; i++) {
    const key = `motivation.msg${String(i).padStart(2, '0')}`;
    const line = t(key).trim();
    if (line) pool.push(line);
  }
  const seen = new Set<string>();
  for (const raw of customMessages) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    pool.push(line);
  }
  if (pool.length === 0) return null;
  const dateKey = dateKeyFromTimestamp(nowMs);
  return pool[stableIndexForDateKey(dateKey, pool.length)] ?? null;
}
