import { MSG } from '../lib/messages';
import type { ExtensionMessage } from '../lib/messages';
import { APP_NAME } from '../lib/branding';
import { BackupValidationError, MAX_BACKUP_BYTES, prepareBackup } from '../lib/backup';
import {
  daysInCalendarMonth,
  normalizeCustomLevels,
  type LevelTag,
  type UiLocale,
} from '../lib/storage';
import { isResolvedLocale } from '../i18n';
import { openWelcomePage } from '../lib/welcomePage';
import { formatDuration } from '../lib/practiceStats';
import {
  parseGoalMinutes,
  writeProgressXpGuideOpen,
  yearHeatmapStatusLabel,
} from './dashboardFormatters';
import { attachYearHeatmapInteractive, type YearHeatmapZoom } from '../lib/yearHeatmapInteractive';
import { DASH_VIEWS } from './dashboardDomUpdate';
import type { DashView, DashboardViewModel } from './dashboardViewModel';
import { uiActionFeedback } from '../lib/uiActionFeedback';

export interface AttachDashboardListenersInput {
  root: HTMLElement;
  vm: DashboardViewModel;
  send: <T>(msg: ExtensionMessage) => Promise<T>;
  signal: AbortSignal;
  suppressStorageRender: () => void;
  switchView: (v: DashView) => void;
  refreshAfterMutation: (panels?: readonly DashView[]) => void | Promise<void>;
  refreshLibraryPanels: () => void;
  afterLibraryDataChange: () => void;
  onSearchBlur?: () => void;
  setActiveView: (v: DashView) => void;
  setSearchQuery: (q: string) => void;
  setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => void;
  setYearHeatmapYear: (y: number) => void;
  getYearHeatmapZoom: () => YearHeatmapZoom;
  setYearHeatmapZoom: (z: YearHeatmapZoom) => void;
  requestPathRebuild: () => void;
  regenerateTodayPath: () => void | Promise<void>;
  pickRoadmapBonus: (tier: string, videoId: string) => void | Promise<void>;
  scheduleDurationBackfill: () => void;
}

export interface AttachLibraryPanelListenersInput {
  root: HTMLElement;
  vm: DashboardViewModel;
  send: <T>(msg: ExtensionMessage) => Promise<T>;
  signal?: AbortSignal;
  refreshLibraryPanels: () => void;
  afterLibraryDataChange: () => void;
  setLibraryLevelFilter: (f: '' | 'unset' | 'legacy' | LevelTag) => void;
}

export function attachLibraryPanelListeners(input: AttachLibraryPanelListenersInput): void {
  const { root, vm, afterLibraryDataChange, refreshLibraryPanels, setLibraryLevelFilter, signal } =
    input;
  const actions = uiActionFeedback(root, vm.t);
  const send = actions.sender(input.send);

  root.querySelectorAll<HTMLButtonElement>('[data-level-filter]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const raw = btn.getAttribute('data-level-filter');
        if (raw === 'all' || raw === null) setLibraryLevelFilter('');
        else if (raw === 'unset') setLibraryLevelFilter('unset');
        else if (raw === 'legacy') setLibraryLevelFilter('legacy');
        else setLibraryLevelFilter(raw as LevelTag);
        refreshLibraryPanels();
      },
      { signal },
    );
  });

  root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
    btn.addEventListener(
      'click',
      (ev) => actions.handle(ev, async () => {
        ev.preventDefault();
        const id = btn.getAttribute('data-remove');
        if (!id) return;
        await send({ type: MSG.REMOVE_LIBRARY, payload: { videoId: id } });
        afterLibraryDataChange();
      }),
      { signal },
    );
  });

  root.querySelectorAll<HTMLButtonElement>('[data-undo-complete]').forEach((btn) => {
    btn.addEventListener(
      'click',
      (ev) => actions.handle(ev, async () => {
        ev.preventDefault();
        const id = btn.getAttribute('data-undo-complete');
        if (!id) return;
        await send({
          type: MSG.SET_LIBRARY_COMPLETION,
          payload: { videoId: id, complete: false },
        });
        afterLibraryDataChange();
      }),
      { signal },
    );
  });
}

export function attachDashboardListeners(input: AttachDashboardListenersInput): void {
  const {
    root,
    vm,
    signal,
    suppressStorageRender,
    switchView,
    refreshAfterMutation,
    refreshLibraryPanels,
    afterLibraryDataChange,
    onSearchBlur,
    setActiveView,
    setSearchQuery,
    setLibraryLevelFilter,
    setYearHeatmapYear,
    getYearHeatmapZoom,
    setYearHeatmapZoom,
    requestPathRebuild,
    regenerateTodayPath,
    pickRoadmapBonus,
    scheduleDurationBackfill,
  } = input;
  const actions = uiActionFeedback(root, vm.t);
  const send = actions.sender(input.send);

  const listen = <K extends keyof HTMLElementEventMap>(
    el: Element | null | undefined,
    type: K,
    handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void | Promise<void>,
  ) => {
    if (!el) return;
    el.addEventListener(type, (event) => actions.handle(event, () => handler.call(el as HTMLElement, event as HTMLElementEventMap[K])), { signal });
  };

  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
    listen(btn, 'click', () => {
      const v = btn.getAttribute('data-view') as DashView | null;
      if (!v) return;
      setActiveView(v);
      switchView(v);
      if (v === 'path') {
        scheduleDurationBackfill();
        void refreshAfterMutation(['path']);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-path-action]').forEach((btn) => {
    listen(btn, 'click', async () => {
      const action = btn.getAttribute('data-path-action');
      if (action === 'regenerate') {
        if (!window.confirm(vm.t('path.regenerateConfirm'))) return;
        await regenerateTodayPath();
        return;
      }
      if (action === 'new-path') {
        requestPathRebuild();
        void refreshAfterMutation(['path']);
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-path-bonus-pick]').forEach((card) => {
    listen(card, 'click', async (e) => {
      if (card.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        return;
      }
      const tier = card.getAttribute('data-path-bonus-pick');
      const videoId = card.getAttribute('data-path-bonus-video');
      if (!tier || !videoId) return;
      await pickRoadmapBonus(tier, videoId);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-path-goto]').forEach((btn) => {
    listen(btn, 'click', () => {
      const target = btn.getAttribute('data-path-goto');
      if (target === 'goals') {
        setActiveView('goals');
        switchView('goals');
      }
    });
  });

  listen(root.querySelector('#dash-search'), 'input', (e) => {
    setSearchQuery((e.target as HTMLInputElement).value);
    refreshLibraryPanels();
  });
  listen(root.querySelector('#dash-search'), 'blur', () => {
    onSearchBlur?.();
  });

  attachLibraryPanelListeners({
    root,
    vm,
    send,
    signal,
    refreshLibraryPanels,
    afterLibraryDataChange,
    setLibraryLevelFilter,
  });

  listen(root.querySelector('#setting-level-framework'), 'change', async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v !== 'jlpt' && v !== 'cefr' && v !== 'custom') return;
    const block = root.querySelector<HTMLElement>('#custom-levels-block');
    if (block) block.hidden = v !== 'custom';
    await send({
      type: MSG.SET_SETTINGS,
      payload: { levelFramework: v },
    });
    void refreshAfterMutation(DASH_VIEWS);
  });

  listen(root.querySelector('#save-custom-levels'), 'click', async () => {
    const el = root.querySelector<HTMLTextAreaElement>('#custom-levels-lines');
    const lines = el?.value.split(/\r?\n/).map((s) => s.trim()) ?? [];
    const normalized = normalizeCustomLevels(lines);
    await send({
      type: MSG.SET_SETTINGS,
      payload: { customLevels: normalized },
    });
    void refreshAfterMutation(['settings', 'library', 'completed']);
  });

  listen(root.querySelector('#setting-ui-locale'), 'change', async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v !== 'auto' && !isResolvedLocale(v)) return;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { uiLocale: v as UiLocale },
    });
    void refreshAfterMutation(DASH_VIEWS);
  });

  listen(root.querySelector('#goal-daily-min'), 'input', (e) => {
    const el = e.target as HTMLInputElement;
    el.value = el.value.replace(/\D/g, '').slice(0, 3);
  });

  listen(root.querySelector('#save-goals'), 'click', async () => {
    const daily = parseGoalMinutes(root.querySelector<HTMLInputElement>('#goal-daily-min'));
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
      payload: { goals: payload },
    });
    void refreshAfterMutation(['goals', 'stats']);
  });

  listen(root.querySelector('#setting-display-name'), 'change', async (e) => {
    const value = (e.target as HTMLInputElement).value;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { displayName: value },
    });
    void refreshAfterMutation([]);
  });

  listen(root.querySelector('#daily-motivation-enabled'), 'change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { dailyMotivationEnabled: checked },
    });
    void refreshAfterMutation([]);
  });

  const customMessageInput = root.querySelector<HTMLInputElement>('#custom-daily-message-input');
  const addCustomMessage = async () => {
    if (!customMessageInput) return;
    const line = customMessageInput.value.trim();
    if (!line) return;
    const next = [...(vm.st.customDailyMessages ?? []), line];
    await send({
      type: MSG.SET_SETTINGS,
      payload: { customDailyMessages: next },
    });
    void refreshAfterMutation(['settings']);
  };
  listen(root.querySelector('#custom-daily-message-add'), 'click', async () => {
    await addCustomMessage();
  });
  listen(customMessageInput, 'keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    return addCustomMessage();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-custom-message-index]').forEach((btn) => {
    listen(btn, 'click', async () => {
      const raw = btn.getAttribute('data-custom-message-index');
      const index = raw == null ? -1 : Number(raw);
      if (!Number.isFinite(index) || index < 0) return;
      const next = (vm.st.customDailyMessages ?? []).filter((_, i) => i !== index);
      await send({
        type: MSG.SET_SETTINGS,
        payload: { customDailyMessages: next },
      });
      void refreshAfterMutation(['settings']);
    });
  });

  listen(root.querySelector('#watch-panel-xp-toasts'), 'change', async (e) => {
    suppressStorageRender();
    const checked = (e.target as HTMLInputElement).checked;
    await send({
      type: MSG.SET_SETTINGS,
      payload: { watchPanelXpToastsEnabled: checked },
    });
  });

  const xpGuide = root.querySelector<HTMLDetailsElement>('.progress-xp-guide');
  if (xpGuide) {
    listen(xpGuide, 'toggle', () => writeProgressXpGuideOpen(xpGuide.open));
  }

  listen(root.querySelector('#enter-prestige'), 'click', async () => {
    const ok = confirm(vm.t('progress.confirmPrestige'));
    if (!ok) return;
    const res = await send<{ ok: boolean; error?: string }>({ type: MSG.PRESTIGE });
    if (!res.ok) {
      window.alert(res.error ?? vm.t('progress.prestigeFailed'));
      return;
    }
    void refreshAfterMutation(['progress', 'stats']);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-ach-filter]').forEach((btn) => {
    listen(btn, 'click', () => {
      const filter = btn.getAttribute('data-ach-filter') ?? 'all';
      root.querySelectorAll('[data-ach-filter]').forEach((chip) => {
        chip.classList.toggle('is-active', chip === btn);
        chip.setAttribute('aria-pressed', String(chip === btn));
      });
      root.querySelectorAll<HTMLElement>('.achievement-section').forEach((section) => {
        const cat = section.getAttribute('data-ach-category') ?? '';
        section.hidden = filter !== 'all' && cat !== filter;
      });
    });
  });

  listen(root.querySelector('#export-extension-data'), 'click', async () => {
    const all = await chrome.storage.local.get(null);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `justpractice-export-${stamp}.json`;
    document.body.append(a);
    try {
      a.click();
      actions.acknowledge('feedback.exportStarted');
    } finally {
      a.remove();
      URL.revokeObjectURL(url);
    }
  });

  const restoreFileInput = root.querySelector<HTMLInputElement>('#restore-extension-file');
  listen(root.querySelector('#restore-extension-data'), 'click', () => {
    restoreFileInput?.click();
  });
  listen(restoreFileInput, 'change', async () => {
    const file = restoreFileInput?.files?.[0];
    if (restoreFileInput) restoreFileInput.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      window.alert(vm.t('dash.restoreTooLarge'));
      return;
    }
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text) as unknown;
    } catch {
      window.alert(vm.t('dash.restoreReadError'));
      return;
    }
    let prepared: ReturnType<typeof prepareBackup>;
    try {
      prepared = prepareBackup(parsed);
    } catch (error) {
      const key = error instanceof BackupValidationError && error.reason === 'version'
        ? 'dash.restoreUnsupportedVersion'
        : error instanceof BackupValidationError && error.reason === 'size'
          ? 'dash.restoreTooLarge' : 'dash.restoreBadFormat';
      window.alert(vm.t(key));
      return;
    }
    const ok = confirm(vm.t('dash.restoreSummary', prepared.summary) + '\n\n' + vm.t('dash.confirmRestoreBody', { app: APP_NAME }));
    if (!ok) return;
    const res = await send<{ ok: boolean; error?: string }>({
      type: MSG.RESTORE_EXTENSION_STORAGE,
      payload: parsed as Record<string, unknown>,
    });
    if (!res.ok) {
      window.alert(res.error ?? vm.t('dash.restoreFailed'));
      return;
    }
    actions.reset();
    void refreshAfterMutation(DASH_VIEWS);
  });

  listen(root.querySelector('#show-welcome-again'), 'click', () => {
    openWelcomePage();
  });

  listen(root.querySelector('#clear-extension-data'), 'click', async () => {
    const ok = confirm(vm.t('dash.confirmClearBody', { app: APP_NAME }));
    if (!ok) return;
    await send({ type: MSG.CLEAR_ALL_EXTENSION_DATA });
    actions.reset();
    void refreshAfterMutation(DASH_VIEWS);
  });

  const pauseEl = root.querySelector<HTMLInputElement>('#pause-unfocused');
  listen(pauseEl, 'change', async () => {
    if (!pauseEl) return;
    suppressStorageRender();
    await send({
      type: MSG.SET_SETTINGS,
      payload: { pauseWhenUnfocused: pauseEl.checked },
    });
  });

  const calTimeEl = root.querySelector<HTMLInputElement>('#calendar-show-practice-time');
  listen(calTimeEl, 'change', async () => {
    if (!calTimeEl) return;
    suppressStorageRender();
    await send({
      type: MSG.SET_SETTINGS,
      payload: { calendarShowPracticeTime: calTimeEl.checked },
    });
  });

  const learningFocusEl = root.querySelector<HTMLInputElement>('#learning-focus-hide-recs');
  listen(learningFocusEl, 'change', async () => {
    if (!learningFocusEl) return;
    suppressStorageRender();
    await send({
      type: MSG.SET_SETTINGS,
      payload: { learningFocusHideRecommendations: learningFocusEl.checked },
    });
  });

  listen(root.querySelector('.year-hm-prev'), 'click', () => {
    setYearHeatmapZoom({ mode: 'year' });
    setYearHeatmapYear(vm.yearHeatmapYear - 1);
    void refreshAfterMutation(['stats']);
  });
  listen(root.querySelector('.year-hm-next'), 'click', () => {
    setYearHeatmapZoom({ mode: 'year' });
    setYearHeatmapYear(vm.yearHeatmapYear + 1);
    void refreshAfterMutation(['stats']);
  });

  const hmRoot = root.querySelector('[data-year-hm-root]');
  if (hmRoot instanceof HTMLElement) {
    const detachHeatmap = attachYearHeatmapInteractive({
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
      navPrevMonthLabel: vm.t('yearHeatmap.prevMonth'),
      navNextMonthLabel: vm.t('yearHeatmap.nextMonth'),
      formatMonthTotal: (sec) =>
        vm.t('yearHeatmap.monthTotal', { duration: formatDuration(sec) }),
      translate: (key, params) => vm.t(key, params),
      initialZoom: getYearHeatmapZoom(),
      onZoomChange: (zoom) => setYearHeatmapZoom(zoom),
    });
    signal.addEventListener('abort', detachHeatmap, { once: true });
  }
}
