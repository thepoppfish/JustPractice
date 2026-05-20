import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { createTranslator, resolveLocale, type Translator } from '../i18n';
import { MSG } from '../lib/messages';
import type { ExtensionResponse, GetStateResponse } from '../lib/messages';
import {
  DEFAULT_CUSTOM_LEVELS,
  defaultSettings,
  ensureSettingsShape,
  type LevelFramework,
  type LevelTag,
} from '../lib/storage';
import { tagsForFramework, isLegacyLevelTag } from '../lib/levelTags';
import {
  fireAsyncFeed,
  getFeedCustomLevels,
  getFeedLevelFramework,
  getFeedTranslator,
  getLibraryVideoIds,
  refreshLibraryIds,
  sendFeedMsg,
} from './feedCardsState';
import type { VideoMeta } from './feedCardsState';
import { scanExistingHoverStrips } from './feedCardsDom';

let popoverHost: HTMLElement | null = null;
let popoverShadow: ShadowRoot | null = null;
let activeAnchor: HTMLElement | null = null;
let activeAnchorRect: DOMRect | null = null;
let activeVideoId: string | null = null;
let outsideCloseListener: ((e: MouseEvent) => void) | null = null;

function closePopover(): void {
  if (outsideCloseListener) {
    document.removeEventListener('click', outsideCloseListener, true);
    outsideCloseListener = null;
  }
  document.removeEventListener('keydown', onKeyDown, true);
  if (popoverHost) {
    popoverHost.style.display = 'none';
  }
  activeAnchor = null;
  activeAnchorRect = null;
  activeVideoId = null;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closePopover();
}

function feedLevelSelectOptionsHtml(
  fw: LevelFramework,
  difficulty: LevelTag | null,
  t: Translator,
  customLevels: readonly string[],
): string {
  const parts: string[] = [`<option value="">${escapeHtml(t('common.unrated'))}</option>`];
  for (const lv of tagsForFramework(fw, customLevels)) {
    const sel = difficulty === lv ? ' selected' : '';
    parts.push(`<option value="${escapeAttr(lv)}"${sel}>${escapeHtml(lv)}</option>`);
  }
  if (difficulty !== null && isLegacyLevelTag(difficulty, fw, customLevels)) {
    parts.push(
      `<option value="${escapeAttr(difficulty)}" selected>${escapeHtml(difficulty)} (${escapeHtml(t('common.legacyShort'))})</option>`,
    );
  }
  return parts.join('');
}

function ensurePopoverHost(): void {
  if (popoverHost) {
    popoverShadow = popoverHost.shadowRoot;
    return;
  }
  popoverHost = document.createElement('div');
  popoverHost.id = 'jp-practice-feed-popover-host';
  popoverHost.style.display = 'none';
  popoverHost.style.position = 'fixed';
  popoverHost.style.zIndex = '2147483646';
  popoverShadow = popoverHost.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(popoverHost);
}

function positionPopoverNearRect(panel: HTMLElement): void {
  if (!popoverHost || !activeAnchorRect) return;
  const r = activeAnchorRect;
  const pad = 8;
  const w = Math.min(panel.offsetWidth || 240, window.innerWidth - 16);
  let left = r.left;
  let top = r.bottom + pad;
  const popH = panel.offsetHeight || 160;
  const popW = w;

  if (left + popW > window.innerWidth - 8) {
    left = window.innerWidth - popW - 8;
  }
  if (left < 8) left = 8;

  if (top + popH > window.innerHeight - 8) {
    top = r.top - pad - popH;
  }
  if (top < 8) top = 8;

  popoverHost.style.left = `${left}px`;
  popoverHost.style.top = `${top}px`;
  popoverHost.style.width = `${Math.ceil(panel.offsetWidth || popW)}px`;
}

export async function openFeedPopover(meta: VideoMeta, anchorRect: DOMRect): Promise<void> {
  if (popoverHost && activeVideoId === meta.videoId && popoverHost.style.display !== 'none') {
    closePopover();
    return;
  }

  closePopover();
  activeAnchor = null;
  activeAnchorRect = anchorRect;
  activeVideoId = meta.videoId;

  let difficulty: LevelTag | null = null;
  let inLibrary = getLibraryVideoIds().has(meta.videoId);
  let fw: LevelFramework = getFeedLevelFramework();
  let t: Translator = getFeedTranslator();
  let customLevels = getFeedCustomLevels();

  try {
    const res = (await sendFeedMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
    if (res?.ok && 'data' in res) {
      const item = res.data.library.find((x) => x.videoId === meta.videoId);
      difficulty = item?.difficulty ?? null;
      inLibrary = Boolean(item);
      const st = ensureSettingsShape({ ...defaultSettings(), ...res.data.settings });
      fw = st.levelFramework ?? 'jlpt';
      customLevels = st.customLevels ?? [...DEFAULT_CUSTOM_LEVELS];
      t = createTranslator(resolveLocale(st.uiLocale));
    }
  } catch {
    /* use defaults */
  }

  ensurePopoverHost();
  if (!popoverShadow) return;

  popoverShadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        font-family: system-ui, Segoe UI, Roboto, sans-serif;
        font-size: 13px;
        color: #eee;
        background: rgba(16, 18, 24, 0.97);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px 14px;
        min-width: 228px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.55);
      }
      .title { font-weight: 600; margin-bottom: 8px; font-size: 12px; line-height: 1.35; max-width: 260px; color: #fff; }
      label { display: block; font-size: 10px; color: #9aa0aa; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
      select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(34, 38, 48, 0.95);
        color: #fff;
        font: inherit;
        margin-bottom: 12px;
      }
      .actions { display: flex; gap: 8px; justify-content: flex-end; }
      button {
        font: inherit;
        padding: 7px 14px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.14);
      }
      .save { background: #1a66ff; color: #fff; border-color: rgba(61, 124, 255, 0.9); }
      .cancel { background: rgba(42, 44, 52, 0.95); color: #eee; }
      .hint { font-size: 11px; color: #7d8496; margin-bottom: 8px; line-height: 1.35; }
    </style>
    <div class="panel">
      <div class="title">${escapeHtml(meta.title.slice(0, 120))}${meta.title.length > 120 ? '…' : ''}</div>
      <p class="hint">${escapeHtml(inLibrary ? t('feed.updateLevel') : t('feed.chooseLevel'))}</p>
      <label for="jp-feed-level">${escapeHtml(t('common.level'))}</label>
      <select id="jp-feed-level" part="level">
        ${feedLevelSelectOptionsHtml(fw, difficulty, t, customLevels)}
      </select>
      <div class="actions">
        <button type="button" class="cancel" part="cancel">${escapeHtml(t('common.cancel'))}</button>
        <button type="button" class="save" part="save">${escapeHtml(t('common.save'))}</button>
      </div>
    </div>
  `;

  const panel = popoverShadow.querySelector('.panel') as HTMLElement;
  const sel = popoverShadow.querySelector('[part="level"]') as HTMLSelectElement;
  const cancelBtn = popoverShadow.querySelector('[part="cancel"]') as HTMLButtonElement;
  const saveBtn = popoverShadow.querySelector('[part="save"]') as HTMLButtonElement;

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fireAsyncFeed(
      (async () => {
        const d = sel.value === '' ? null : (sel.value as LevelTag);
        if (inLibrary) {
          const res = (await sendFeedMsg<ExtensionResponse>({
            type: MSG.SET_DIFFICULTY,
            payload: { videoId: meta.videoId, difficulty: d },
          })) as ExtensionResponse;
          if (!res.ok) {
            const hintEl = popoverShadow?.querySelector('.hint');
            if (hintEl) {
              hintEl.textContent = res.error;
              (hintEl as HTMLElement).style.color = '#f88';
            }
            return;
          }
          await refreshLibraryIds();
          scanExistingHoverStrips();
          closePopover();
          return;
        }
        const res = (await sendFeedMsg<ExtensionResponse>({
          type: MSG.ADD_OR_UPDATE_LIBRARY,
          payload: {
            videoId: meta.videoId,
            title: meta.title,
            channel: meta.channel,
            difficulty: d,
          },
        })) as ExtensionResponse;
        await refreshLibraryIds();
        scanExistingHoverStrips();
        if (!res.ok) {
          const hintEl = popoverShadow?.querySelector('.hint');
          if (hintEl) {
            hintEl.textContent = res.error;
            (hintEl as HTMLElement).style.color = '#f88';
          }
          return;
        }
        closePopover();
      })(),
    );
  });

  popoverHost!.style.display = 'block';

  requestAnimationFrame(() => {
    positionPopoverNearRect(panel);
    if (popoverHost && panel.offsetWidth) {
      popoverHost.style.width = `${panel.offsetWidth}px`;
    }
  });

  window.setTimeout(() => {
    outsideCloseListener = (e: MouseEvent) => {
      const path = e.composedPath();
      if (popoverHost && path.includes(popoverHost)) return;
      if (activeAnchor && path.includes(activeAnchor)) return;
      closePopover();
    };
    document.addEventListener('click', outsideCloseListener, true);
  }, 120);

  document.addEventListener('keydown', onKeyDown, true);
}
