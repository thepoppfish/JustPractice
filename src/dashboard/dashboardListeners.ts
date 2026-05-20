import { MSG } from '../lib/messages';
import type { ExtensionMessage } from '../lib/messages';
import { APP_NAME } from '../lib/branding';
import {
  daysInCalendarMonth,
  normalizeCustomLevels,
  type LevelTag,
  type UiLocale,
} from '../lib/storage';
import { isResolvedLocale } from '../i18n';
import { parseGoalMinutes, parseNudgeHour, yearHeatmapStatusLabel } from './dashboardFormatters';
import { attachYearHeatmapInteractive } from '../lib/yearHeatmapInteractive';
import type { DashView, DashboardViewModel } from './dashboardViewModel';

export interface AttachDashboardListenersInput {
  root: HTMLElement;
  vm: DashboardViewModel;
  send: <T>(msg: ExtensionMessage) => Promise<T>;
  render: () => void;
  refreshLibraryPanels: () => void;
  afterLibraryDataChange: () => void;
  onSearchBlur?: () => void;
  setActiveView: (v: DashView) => void;
  setSearchQuery: (q: string) => void;
  setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => void;
  setYearHeatmapYear: (y: number) => void;
}

export interface AttachLibraryPanelListenersInput {
  root: HTMLElement;
  vm: DashboardViewModel;
  send: <T>(msg: ExtensionMessage) => Promise<T>;
  render: () => void;
  refreshLibraryPanels: () => void;
  afterLibraryDataChange: () => void;
  setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => void;
}

export function attachLibraryPanelListeners(input: AttachLibraryPanelListenersInput): void {
  const { root, vm, send, afterLibraryDataChange, refreshLibraryPanels, setLibraryLevelFilter } =
    input;

  root.querySelectorAll<HTMLButtonElement>('[data-level-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.getAttribute('data-level-filter');
      if (raw === 'all' || raw === null) setLibraryLevelFilter('');
      else if (raw === 'unset') setLibraryLevelFilter('unset');
      else if (raw === 'legacy') setLibraryLevelFilter('legacy');
      else setLibraryLevelFilter(raw as LevelTag);
      refreshLibraryPanels();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const id = btn.getAttribute('data-remove');
      if (!id) return;
      await send({ type: MSG.REMOVE_LIBRARY, payload: { videoId: id } });
      afterLibraryDataChange();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-undo-complete]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const id = btn.getAttribute('data-undo-complete');
      if (!id) return;
      await send({
        type: MSG.SET_LIBRARY_COMPLETION,
        payload: { videoId: id, complete: false },
      });
      afterLibraryDataChange();
    });
  });
}

export function attachDashboardListeners(input: AttachDashboardListenersInput): void {
  const {
    root,
    vm,
    send,
    render,
    refreshLibraryPanels,
    afterLibraryDataChange,
    onSearchBlur,
    setActiveView,
    setSearchQuery,
    setLibraryLevelFilter,
    setYearHeatmapYear,
  } = input;

  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-view') as DashView | null;
      if (!v) return;
      setActiveView(v);
      render();
    });
  });

  root.querySelector('#dash-search')?.addEventListener('input', (e) => {
    setSearchQuery((e.target as HTMLInputElement).value);
    refreshLibraryPanels();
  });
  root.querySelector('#dash-search')?.addEventListener('blur', () => {
    onSearchBlur?.();
  });

  attachLibraryPanelListeners({
    root,
    vm,
    send,
    render,
    refreshLibraryPanels,
    afterLibraryDataChange,
    setLibraryLevelFilter,
  });

  root.querySelector('#setting-level-framework')?.addEventListener('change', async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v !== 'jlpt' && v !== 'cefr' && v !== 'custom') return;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { levelFramework: v },
    });
    render();
  });

  root.querySelector('#save-custom-levels')?.addEventListener('click', async () => {
    const el = root.querySelector<HTMLTextAreaElement>('#custom-levels-lines');
    const lines = el?.value.split(/\r?\n/).map((s) => s.trim()) ?? [];
    const normalized = normalizeCustomLevels(lines);
    await send({
      type: MSG.SET_SETTINGS,
      payload: { customLevels: normalized },
    });
    render();
  });

  root.querySelector('#setting-ui-locale')?.addEventListener('change', async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v !== 'auto' && !isResolvedLocale(v)) return;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { uiLocale: v as UiLocale },
    });
    render();
  });

  root.querySelector('#save-goals')?.addEventListener('click', async () => {
    const daily = parseGoalMinutes(root.querySelector<HTMLInputElement>('#goal-daily-min'));
    const nudgeHour = parseNudgeHour(root.querySelector<HTMLInputElement>('#goal-nudge-hour'));
    const payload =
      daily === null || daily <= 0 ?
        { dailyTargetSec: null, weeklyTargetSec: null, monthlyTargetSec: null }
      : (() => {
          const d = daily;
          const now = Date.now();
          return {
            dailyTargetSec: d,
            weeklyTargetSec: d * 7,
            monthlyTargetSec: d * daysInCalendarMonth(now),
          };
        })();
    await send({
      type: MSG.SET_SETTINGS,
      payload: { goals: payload, goalNudgeHourLocal: nudgeHour },
    });
    render();
  });

  root.querySelector('#goal-notifications')?.addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { goalNotificationsEnabled: checked },
    });
    render();
  });

  root.querySelector('#xp-notifications')?.addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { xpNotificationsEnabled: checked },
    });
    render();
  });

  root.querySelector('#enter-prestige')?.addEventListener('click', async () => {
    const ok = confirm(vm.t('progress.confirmPrestige'));
    if (!ok) return;
    const res = await send<{ ok: boolean; error?: string }>({ type: MSG.PRESTIGE });
    if (!res.ok) {
      window.alert(res.error ?? vm.t('progress.prestigeFailed'));
      return;
    }
    render();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-ach-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-ach-filter') ?? 'all';
      root.querySelectorAll('[data-ach-filter]').forEach((chip) => {
        chip.classList.toggle('is-active', chip === btn);
      });
      root.querySelectorAll<HTMLElement>('.achievement-section').forEach((section) => {
        const cat = section.getAttribute('data-ach-category') ?? '';
        section.hidden = filter !== 'all' && cat !== filter;
      });
    });
  });

  root.querySelector('#export-extension-data')?.addEventListener('click', async () => {
    try {
      const all = await chrome.storage.local.get(null);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `justpractice-export-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  });

  const restoreFileInput = root.querySelector<HTMLInputElement>('#restore-extension-file');
  root.querySelector('#restore-extension-data')?.addEventListener('click', () => {
    restoreFileInput?.click();
  });
  restoreFileInput?.addEventListener('change', async () => {
    const file = restoreFileInput.files?.[0];
    restoreFileInput.value = '';
    if (!file) return;
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text) as unknown;
    } catch {
      window.alert(vm.t('dash.restoreReadError'));
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      window.alert(vm.t('dash.restoreBadFormat'));
      return;
    }
    const ok = confirm(vm.t('dash.confirmRestoreBody', { app: APP_NAME }));
    if (!ok) return;
    const res = await send<{ ok: boolean; error?: string }>({
      type: MSG.RESTORE_EXTENSION_STORAGE,
      payload: parsed as Record<string, unknown>,
    });
    if (!res.ok) {
      window.alert(res.error ?? vm.t('dash.restoreFailed'));
      return;
    }
    render();
  });

  root.querySelector('#clear-extension-data')?.addEventListener('click', async () => {
    const ok = confirm(vm.t('dash.confirmClearBody', { app: APP_NAME }));
    if (!ok) return;
    await send({ type: MSG.CLEAR_ALL_EXTENSION_DATA });
    render();
  });

  const pauseEl = root.querySelector<HTMLInputElement>('#pause-unfocused');
  pauseEl?.addEventListener('change', async () => {
    await send({
      type: MSG.SET_SETTINGS,
      payload: { pauseWhenUnfocused: pauseEl.checked },
    });
    render();
  });

  const calTimeEl = root.querySelector<HTMLInputElement>('#calendar-show-practice-time');
  calTimeEl?.addEventListener('change', async () => {
    await send({
      type: MSG.SET_SETTINGS,
      payload: { calendarShowPracticeTime: calTimeEl.checked },
    });
    render();
  });

  root.querySelector('.year-hm-prev')?.addEventListener('click', () => {
    setYearHeatmapYear(vm.yearHeatmapYear - 1);
    render();
  });
  root.querySelector('.year-hm-next')?.addEventListener('click', () => {
    setYearHeatmapYear(vm.yearHeatmapYear + 1);
    render();
  });

  const hmRoot = root.querySelector('[data-year-hm-root]');
  if (hmRoot instanceof HTMLElement) {
    attachYearHeatmapInteractive({
      root: hmRoot,
      locale: vm.resolvedLocale,
      variant: 'dashboard',
      getYear: () => vm.yearHeatmapYear,
      getData: () => ({
        dailySeconds: vm.data.dailySeconds,
        extensionInstalledDateKey: vm.data.extensionInstalledDateKey,
        dailyGoalSec: vm.dailyGoalSec,
        monthlyGoalSec: vm.rg.monthlyTargetSec,
      }),
      statusLabel: (display, dateKey, seconds = 0, showTimeArg = false) =>
        yearHeatmapStatusLabel(vm.t, display, dateKey, seconds, showTimeArg),
      showPracticeTimeOnYear: vm.calendarShowPracticeTime,
      backToYearLabel: vm.t('yearHeatmap.backToYear'),
    });
  }
}
