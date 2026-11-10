import type { LibraryItem, PersistedData } from './storage';
import { escapeAttr, escapeHtml } from './htmlEscape';
import { formatPracticeDuration } from './practiceDuration';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function playbackForLibraryItem(item: LibraryItem, data: PersistedData): { href: string; position: number; duration: number | null; resume: boolean } {
  const duration = item.durationSec != null && Number.isFinite(item.durationSec) && item.durationSec > 0 ? item.durationSec : null;
  const raw = data.videoPlaybackPositionSec[item.videoId];
  const position = Number.isFinite(raw) ? Math.max(0, Math.floor(duration ? Math.min(raw, duration) : raw)) : 0;
  const resume = item.completedAt == null && position > 0 && (!duration || position < duration - 1);
  const href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}${resume ? `&t=${position}s` : ''}`;
  return { href, position, duration, resume };
}

function clock(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const suffix = `${String(minutes % 60).padStart(minutes >= 60 ? 2 : 1, '0')}:${String(total % 60).padStart(2, '0')}`;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${suffix}` : suffix;
}

/** Practice can exceed a video's length; only playback position drives this progress. */
export function libraryMetricsHtml(item: LibraryItem, data: PersistedData, t: Translate): string {
  const { position, duration } = playbackForLibraryItem(item, data);
  const length = duration ? clock(duration) : t('library.unknownLength');
  const playback = `${clock(position)} / ${length}`;
  return `<div class="library-metrics">
    <span>${escapeHtml(t('library.length'))}: <bdi>${escapeHtml(length)}</bdi></span>
    <span>${escapeHtml(t('library.practice'))}: <bdi>${escapeHtml(formatPracticeDuration(data.videoSeconds[item.videoId] ?? 0, t))}</bdi></span>
    <span>${escapeHtml(t('library.playback'))}: <bdi>${escapeHtml(playback)}</bdi></span>
    ${duration ? `<progress max="${duration}" value="${position}" aria-label="${escapeAttr(`${t('library.playback')}: ${item.title}`)}" aria-valuetext="${escapeAttr(playback)}"></progress>` : ''}
  </div>`;
}

export function librarySecondaryActionsHtml(item: LibraryItem, prefix: string, t: Translate, levelOptions?: readonly string[]): string {
  const id = `${prefix}-${item.videoId}`;
  const tags = [...new Set([...(levelOptions ?? []), ...(item.difficulty ? [item.difficulty] : [])])];
  return `<details class="library-more" id="${escapeAttr(id)}-actions">
    <summary id="${escapeAttr(id)}-summary" aria-label="${escapeAttr(`${t('library.more')}: ${item.title}`)}">${escapeHtml(t('library.more'))}</summary>
    <div class="library-secondary">
      ${levelOptions ? `<label for="${escapeAttr(id)}-level">${escapeHtml(t('common.level'))}</label>
      <select id="${escapeAttr(id)}-level" data-library-level="${escapeAttr(item.videoId)}" aria-label="${escapeAttr(`${t('common.level')}: ${item.title}`)}">
        <option value="" ${item.difficulty === null ? 'selected' : ''}>${escapeHtml(t('common.unrated'))}</option>
        ${tags.map((tag) => `<option value="${escapeAttr(tag)}" ${item.difficulty === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
      </select>` : ''}
      <button type="button" id="${escapeAttr(id)}-completion" class="btn-secondary-sm" data-library-complete="${escapeAttr(item.videoId)}" data-complete="${item.completedAt == null}">${escapeHtml(t(item.completedAt == null ? 'library.markComplete' : 'dash.undoComplete'))}</button>
      <button type="button" id="${escapeAttr(id)}-remove" class="btn-remove" data-remove="${escapeAttr(item.videoId)}">${escapeHtml(t('common.remove'))}</button>
    </div>
  </details>`;
}
