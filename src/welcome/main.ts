import { MSG } from '../lib/messages';
import type { ExtensionMessage, GetStateResponse } from '../lib/messages';
import { appIconUrl } from '../lib/branding';
import { escapeAttr, escapeHtml } from '../lib/htmlEscape';
import { goalsFromDailyMinutes, parseDailyGoalMinutesInput } from '../lib/practiceGoals';
import type { LevelFramework, UiLocale } from '../lib/storage';
import { sendChecked } from '../lib/extensionMessaging';
import { uiActionFeedback } from '../lib/uiActionFeedback';
import {
  WELCOME_GOAL_PRESET_MINUTES,
  WELCOME_TUTORIAL_VIDEO_ID,
  welcomeTutorialThumbnailUrl,
  welcomeTutorialWatchUrl,
} from '../lib/welcomeConfig';
import {
  createTranslator,
  applyUiLocale,
  LOCALE_DROPDOWN,
  resolveLocale,
  SUPPORTED_RESOLVED_LOCALES,
} from '../i18n';
import {
  buildHelloSlides,
  startHelloCarousel,
  type HelloCarouselController,
  type HelloSlide,
} from './welcomeHelloAnimation';

const STEP_COUNT = 5;

type UiLocaleChoice = Exclude<UiLocale, 'auto'>;

interface WizardState {
  step: number;
  uiLocale: UiLocaleChoice | null;
  levelFramework: LevelFramework;
  goalMinutes: number | null;
  goalInput: string;
  saved: boolean;
}

const app = document.getElementById('app')!;

let t = createTranslator(resolveLocale('auto'));
const actions = uiActionFeedback(app, (key) => t(key));
let helloController: HelloCarouselController | null = null;
let carouselIndex = 0;
/** True after the user taps a language chip — stops the hello cycle. */
let helloAnimationLocked = false;

const state: WizardState = {
  step: 0,
  uiLocale: null,
  levelFramework: 'jlpt',
  goalMinutes: null,
  goalInput: '',
  saved: false,
};

async function sendMsg<T>(msg: ExtensionMessage): Promise<T> {
  return sendChecked<T>(msg);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stepLabels(): string[] {
  return [
    t('welcome.stepLanguage'),
    t('welcome.stepFramework'),
    t('welcome.stepGoal'),
    t('welcome.stepTutorial'),
    t('welcome.stepDone'),
  ];
}

function localeChoices(): readonly { value: UiLocaleChoice; flag: string; nativeName: string }[] {
  return LOCALE_DROPDOWN.filter(
    (row): row is { value: UiLocaleChoice; flag: string; nativeName: string } =>
      row.value !== 'auto',
  );
}

function initialHelloSlide(): HelloSlide {
  const slides = buildHelloSlides();
  const preferred = state.uiLocale ?? resolveLocale('auto');
  const idx = slides.findIndex((s) => s.locale === preferred);
  return slides[idx >= 0 ? idx : 0]!;
}

function helloDotsHtml(): string {
  return buildHelloSlides()
    .map((slide, i) => {
      const active = i === carouselIndex;
      return `<span class="welcome-hello-dot${active ? ' is-active' : ''}" title="${escapeAttr(slide.label)}"></span>`;
    })
    .join('');
}

function languageStepHtml(): string {
  const chips = localeChoices()
    .map((row) => {
      const isSel = state.uiLocale !== null && row.value === state.uiLocale;
      const cls = ['welcome-lang-chip', isSel ? 'is-selected' : ''].filter(Boolean).join(' ');
      return `<label class="${cls}"><input type="radio" name="ui-locale" value="${escapeAttr(row.value)}" data-locale="${escapeAttr(row.value)}"${isSel ? ' checked' : ''} /><bdi lang="${row.value}" dir="auto">${escapeHtml(`${row.flag} ${row.nativeName}`)}</bdi></label>`;
    })
    .join('');

  const slide = helloAnimationLocked ? buildHelloSlides().find((s) => s.locale === state.uiLocale) : initialHelloSlide();

  return `
    <h2 class="welcome-step-title visually-hidden" tabindex="-1">${escapeHtml(t('welcome.stepLanguage'))}</h2>
    <div class="welcome-hello-hero">
      <div class="welcome-hello-glow" aria-hidden="true"></div>
      <div class="welcome-hello-stage" aria-hidden="true">
        <p class="welcome-hello-word" dir="${slide?.dir ?? 'ltr'}" lang="${escapeAttr(slide?.locale ?? 'en')}">${escapeHtml(slide?.hello ?? '')}</p>
      </div>
      <p class="welcome-hello-locale-label" aria-hidden="true">${escapeHtml(slide ? `${slide.flag} ${slide.label}` : '')}</p>
      <div class="welcome-hello-dots" aria-hidden="true">${helloDotsHtml()}</div>
      <p class="welcome-carousel-sub">${escapeHtml(t('welcome.subtitle'))}</p>
      <p class="welcome-carousel-pick">${escapeHtml(t('welcome.pickLanguage'))}</p>
    </div>
    <fieldset class="welcome-lang-grid"><legend class="visually-hidden">${escapeHtml(t('welcome.pickLanguage'))}</legend>
      ${chips}
    </fieldset>`;
}

function frameworkStepHtml(): string {
  const options: { value: LevelFramework; titleKey: string; metaKey: string }[] = [
    { value: 'jlpt', titleKey: 'framework.jlpt', metaKey: 'framework.jlptLevels' },
    { value: 'cefr', titleKey: 'framework.cefr', metaKey: 'framework.cefrLevels' },
    { value: 'custom', titleKey: 'framework.custom', metaKey: 'welcome.frameworkCustomHint' },
  ];

  const cards = options
    .map((opt) => {
      const sel = state.levelFramework === opt.value;
      const meta =
        opt.value === 'custom' ? t('welcome.frameworkCustomHint') : t(opt.metaKey);
      return `
        <label class="welcome-framework-card${sel ? ' is-selected' : ''}">
          <input type="radio" name="level-framework" value="${escapeAttr(opt.value)}"${sel ? ' checked' : ''} />
          <span>
            <span class="welcome-framework-label">${escapeHtml(t(opt.titleKey))}</span>
            <span class="welcome-framework-meta">${escapeHtml(meta)}</span>
          </span>
        </label>`;
    })
    .join('');

  return `
    <h2 class="welcome-step-title" tabindex="-1">${escapeHtml(t('welcome.frameworkTitle'))}</h2>
    <p class="welcome-step-lead">${escapeHtml(t('welcome.frameworkHint'))}</p>
    <fieldset class="welcome-framework-grid"><legend class="visually-hidden">${escapeHtml(t('welcome.frameworkTitle'))}</legend>${cards}</fieldset>`;
}

function ensureGoalDefaults(): void {
  if (state.goalMinutes === null && state.goalInput === '') {
    state.goalMinutes = 30;
    state.goalInput = '30';
  }
}

function goalStepHtml(): string {
  ensureGoalDefaults();
  const presets = WELCOME_GOAL_PRESET_MINUTES.map((minutes) => {
    const sel = state.goalMinutes === minutes;
    return `<button type="button" class="welcome-goal-chip${sel ? ' is-selected' : ''}" data-goal-minutes="${minutes}" aria-pressed="${sel}">${escapeHtml(t('welcome.goalPresetMin', { minutes }))}</button>`;
  }).join('');

  return `
    <h2 class="welcome-step-title" tabindex="-1">${escapeHtml(t('welcome.goalTitle'))}</h2>
    <p class="welcome-step-lead">${escapeHtml(t('welcome.goalHint'))}</p>
    <div class="welcome-goal-row">${presets}</div>
    <div class="welcome-goal-field">
      <label for="welcome-goal-minutes">${escapeHtml(t('welcome.goalMinutesLabel'))}</label>
      <input
        type="text"
        id="welcome-goal-minutes"
        dir="ltr"
        class="welcome-goal-input"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="3"
        autocomplete="off"
        placeholder="30"
        value="${escapeAttr(state.goalInput)}"
      />
    </div>
    <p class="welcome-goal-reset-hint">${escapeHtml(t('welcome.goalResetLater'))}</p>`;
}

function openWelcomeTutorialVideo(): void {
  const videoId = WELCOME_TUTORIAL_VIDEO_ID.trim();
  if (!videoId) return;
  void chrome.tabs.create({ url: welcomeTutorialWatchUrl(videoId) });
}

function tutorialStepHtml(): string {
  const videoId = WELCOME_TUTORIAL_VIDEO_ID.trim();
  const videoBlock =
    videoId ?
      `<p class="welcome-tutorial-watch-prompt">${escapeHtml(t('welcome.tutorialWatchPrompt'))}</p>
    <button type="button" class="welcome-video-wrap welcome-video-poster" id="welcome-watch-tutorial" aria-label="${escapeAttr(t('welcome.tutorialWatchOnYoutube'))}">
      <img class="welcome-video-thumb" src="${escapeAttr(welcomeTutorialThumbnailUrl(videoId))}" alt="" loading="lazy" />
      <span class="welcome-video-play" aria-hidden="true"></span>
      <span class="welcome-video-cta">${escapeHtml(t('welcome.tutorialWatchOnYoutube'))}</span>
    </button>`
    : `<div class="welcome-video-wrap"><div class="welcome-video-placeholder">${escapeHtml(t('welcome.tutorialVideoComingSoon'))}</div></div>`;

  return `
    <h2 class="welcome-step-title" tabindex="-1">${escapeHtml(t('welcome.tutorialTitle'))}</h2>
    <p class="welcome-step-lead">${escapeHtml(t('welcome.tutorialHint'))}</p>
    ${videoBlock}`;
}

function doneStepHtml(): string {
  return `
    <div class="welcome-done-icon" aria-hidden="true">✓</div>
    <h2 class="welcome-step-title" tabindex="-1">${escapeHtml(t('welcome.doneTitle'))}</h2>
    <p class="welcome-step-lead">${escapeHtml(t('welcome.doneSubtitle'))}</p>
    <p class="welcome-pin-hint">${escapeHtml(t('welcome.pinHint'))}</p>
    <div class="welcome-actions">
      <button type="button" class="welcome-btn welcome-btn--primary jp-primary" id="welcome-open-youtube">${escapeHtml(t('welcome.openYoutube'))}</button>
      <button type="button" class="welcome-btn" id="welcome-open-dashboard">${escapeHtml(t('welcome.openDashboard'))}</button>
    </div>`;
}

function stepBodyHtml(): string {
  switch (state.step) {
    case 0:
      return languageStepHtml();
    case 1:
      return frameworkStepHtml();
    case 2:
      return goalStepHtml();
    case 3:
      return tutorialStepHtml();
    case 4:
      return doneStepHtml();
    default:
      return '';
  }
}

function progressHtml(): string {
  const labels = stepLabels();
  return labels
    .map((label, i) => {
      const cls =
        i === state.step ? ' is-active'
        : i < state.step ? ' is-done'
        : '';
      return `<li${i === state.step ? ' aria-current="step"' : ''}><span class="welcome-progress-dot${cls}" aria-hidden="true"></span><span class="visually-hidden">${escapeHtml(label)}</span></li>`;
    })
    .join('');
}

function navHtml(): string {
  if (state.step >= 4) return '';
  const showBack = state.step > 0;
  return `
    <div class="welcome-actions welcome-actions--split${showBack ? '' : ' welcome-actions--continue-only'}">
      ${showBack ? `<button type="button" class="welcome-btn welcome-btn--ghost" id="welcome-back">${escapeHtml(t('welcome.back'))}</button>` : '<span></span>'}
      <button type="button" class="welcome-btn welcome-btn--primary jp-primary" id="welcome-continue">${escapeHtml(t('welcome.continue'))}</button>
    </div>`;
}

function render(): void {
  actions.captureDrafts();
  document.title = t('welcome.pageTitle');
  applyUiLocale(state.uiLocale ?? resolveLocale('auto'));

  app.innerHTML = `
    <div class="welcome-shell">
      <header class="welcome-header">
        <img class="welcome-logo" src="${escapeAttr(appIconUrl(48))}" width="40" height="40" alt="" />
        <h1 class="welcome-brand">JustPractice</h1>
      </header>
      <main class="welcome-card" aria-label="${escapeAttr(t('welcome.progressAria', { current: state.step + 1, total: STEP_COUNT }))}">
        <ol class="welcome-progress" aria-label="${escapeAttr(t('welcome.progressAria', { current: state.step + 1, total: STEP_COUNT }))}">${progressHtml()}</ol>
        ${stepBodyHtml()}
        ${navHtml()}
        <p class="welcome-privacy">${escapeHtml(t('welcome.privacy'))}</p>
      </main>
    </div>`;

  wireStepEvents();
  actions.restore();
  if (state.step === 0 && !helloAnimationLocked) {
    mountHelloAnimation();
  } else {
    stopHelloAnimation();
  }
}

function stopHelloAnimation(): void {
  helloController?.stop();
  helloController = null;
}

function syncHelloCarouselChrome(): void {
  app.querySelectorAll<HTMLElement>('.welcome-hello-dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === carouselIndex);
  });
}

function mountHelloAnimation(): void {
  stopHelloAnimation();
  const helloEl = app.querySelector<HTMLElement>('.welcome-hello-word');
  const labelEl = app.querySelector<HTMLElement>('.welcome-hello-locale-label');
  if (!helloEl || !labelEl) return;

  const slides = buildHelloSlides();
  const preferred = state.uiLocale ?? resolveLocale('auto');
  const startIdx = slides.findIndex((s) => s.locale === preferred);
  carouselIndex = startIdx >= 0 ? startIdx : 0;

  helloController = startHelloCarousel({
    helloEl,
    labelEl,
    reducedMotion: prefersReducedMotion(),
    initialIndex: carouselIndex,
    onIndexChange: (i) => {
      carouselIndex = i;
      syncHelloCarouselChrome();
    },
  });
}

function applyLocaleChoice(locale: UiLocaleChoice): void {
  state.uiLocale = locale;
  helloAnimationLocked = true;
  stopHelloAnimation();
  carouselIndex = SUPPORTED_RESOLVED_LOCALES.indexOf(locale);
  if (carouselIndex < 0) carouselIndex = 0;
  t = createTranslator(locale);
  render();
  app.querySelector<HTMLInputElement>(`input[data-locale="${locale}"]`)?.focus();
}

function readGoalFromDom(): void {
  const input = app.querySelector<HTMLInputElement>('#welcome-goal-minutes');
  if (!input) return;
  state.goalInput = input.value;
  state.goalMinutes = parseDailyGoalMinutesInput(input.value);
}

async function persistOnboarding(): Promise<void> {
  if (state.saved) return;
  const uiLocale: UiLocale = state.uiLocale ?? resolveLocale('auto');
  const goals = goalsFromDailyMinutes(state.goalMinutes);
  await actions.sender(sendMsg)({
    type: MSG.SET_SETTINGS,
    payload: {
      uiLocale,
      levelFramework: state.levelFramework,
      goals,
      onboardingCompletedAt: Date.now(),
    },
  });
  state.saved = true;
}

async function goToStep(next: number): Promise<void> {
  if (next > state.step && state.step === 3) {
    readGoalFromDom();
    await persistOnboarding();
  }
  state.step = Math.max(0, Math.min(STEP_COUNT - 1, next));
  if (state.step === 0) helloAnimationLocked = state.uiLocale !== null;
  render();
  app.querySelector<HTMLElement>('.welcome-step-title')?.focus();
  if (state.step === 4 && !state.saved) {
    await persistOnboarding();
  }
}

function wireStepEvents(): void {
  app.querySelectorAll<HTMLInputElement>('input[data-locale]').forEach((input) => {
    input.addEventListener('focus', stopHelloAnimation);
    input.addEventListener('change', () => {
      const locale = input.dataset.locale as UiLocaleChoice | undefined;
      if (!locale) return;
      applyLocaleChoice(locale);
    });
  });

  app.querySelectorAll<HTMLInputElement>('input[name="level-framework"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.levelFramework = input.value as LevelFramework;
      app.querySelectorAll('.welcome-framework-card').forEach((card) => {
        card.classList.toggle('is-selected', card.contains(input));
      });
    });
  });

  app.querySelectorAll<HTMLButtonElement>('.welcome-goal-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.dataset.goalMinutes);
      if (!Number.isFinite(minutes)) return;
      state.goalMinutes = minutes;
      state.goalInput = String(minutes);
      const input = app.querySelector<HTMLInputElement>('#welcome-goal-minutes');
      if (input) input.value = state.goalInput;
      syncGoalChips();
    });
  });

  app.querySelector('#welcome-goal-minutes')?.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    state.goalInput = el.value.replace(/\D/g, '').slice(0, 3);
    el.value = state.goalInput;
    state.goalMinutes = parseDailyGoalMinutesInput(state.goalInput);
    syncGoalChips();
  });

  app.querySelector('#welcome-back')?.addEventListener('click', (event) => actions.handle(event, async () => {
    if (state.step === 2) readGoalFromDom();
    await goToStep(state.step - 1);
  }));

  app.querySelector('#welcome-continue')?.addEventListener('click', (event) => actions.handle(event, async () => {
    if (state.step === 0 && !state.uiLocale) {
      const fromCarousel = SUPPORTED_RESOLVED_LOCALES[carouselIndex];
      state.uiLocale = fromCarousel ?? resolveLocale('auto');
      t = createTranslator(state.uiLocale);
    }
    if (state.step === 2) readGoalFromDom();
    await goToStep(state.step + 1);
  }));

  app.querySelector('#welcome-watch-tutorial')?.addEventListener('click', () => {
    openWelcomeTutorialVideo();
  });

  app.querySelector('#welcome-open-youtube')?.addEventListener('click', () => {
    void chrome.tabs.create({ url: 'https://www.youtube.com/' });
  });

  app.querySelector('#welcome-open-dashboard')?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });
}

function syncGoalChips(): void {
  app.querySelectorAll<HTMLButtonElement>('.welcome-goal-chip').forEach((chip) => {
    const selected = Number(chip.dataset.goalMinutes) === state.goalMinutes;
    chip.classList.toggle('is-selected', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });
}

async function prefillFromStorage(): Promise<void> {
  try {
    const res = (await sendMsg<GetStateResponse>({ type: MSG.GET_STATE })) as GetStateResponse;
    if (!res?.ok || !('data' in res)) return;
    const { settings } = res.data;
    const loc = settings.uiLocale;
    if (loc && loc !== 'auto') {
      state.uiLocale = loc;
      t = createTranslator(loc);
    }
    if (settings.levelFramework) {
      state.levelFramework = settings.levelFramework;
    }
    const daily = settings.goals?.dailyTargetSec;
    if (typeof daily === 'number' && daily > 0) {
      state.goalMinutes = Math.round(daily / 60);
      state.goalInput = String(state.goalMinutes);
    }
  } catch {
    /* first install — defaults are fine */
  }
}

void (async () => {
  await prefillFromStorage();
  helloAnimationLocked = false;
  const slides = buildHelloSlides();
  const preferred = state.uiLocale ?? resolveLocale('auto');
  const idx = slides.findIndex((s) => s.locale === preferred);
  carouselIndex = idx >= 0 ? idx : 0;
  render();
})();
