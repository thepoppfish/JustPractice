type Translate = (key: string) => string;

/** Practice summaries share units; video length and playback position keep clock notation. */
export function formatPracticeDuration(seconds: number, t: Translate): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const remainder = value % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${t('time.hours')}`);
  if (minutes) parts.push(`${minutes} ${t('time.minutes')}`);
  if (!hours && remainder) parts.push(`${remainder} ${t('time.seconds')}`);
  return parts.join(' ') || `0 ${t('time.minutes')}`;
}
