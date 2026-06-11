import { animate } from 'animejs';
import {
  createTranslator,
  LOCALE_DROPDOWN,
  SUPPORTED_RESOLVED_LOCALES,
  type ResolvedLocale,
} from '../i18n';

export interface HelloSlide {
  locale: ResolvedLocale;
  hello: string;
  flag: string;
  label: string;
  dir: 'ltr' | 'rtl';
}

/** Every supported UI locale's `welcome.hello` string for the intro animation. */
export function buildHelloSlides(): HelloSlide[] {
  return SUPPORTED_RESOLVED_LOCALES.map((locale) => {
    const row = LOCALE_DROPDOWN.find((x) => x.value === locale);
    return {
      locale,
      hello: createTranslator(locale)('welcome.hello'),
      flag: row?.flag ?? '',
      label: row?.nativeName ?? locale,
      dir: locale === 'he' ? 'rtl' : 'ltr',
    };
  });
}

export type HelloCarouselController = { stop: () => void };

/**
 * Cycles through every hello translation with enter/exit motion (iPhone-style).
 */
export function startHelloCarousel(p: {
  helloEl: HTMLElement;
  labelEl: HTMLElement;
  reducedMotion: boolean;
  initialIndex?: number;
  onIndexChange: (index: number, slide: HelloSlide) => void;
}): HelloCarouselController {
  const slides = buildHelloSlides();
  let index = p.initialIndex ?? 0;
  if (index < 0 || index >= slides.length) index = 0;

  let running = true;
  let animating = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;

  const holdMs = p.reducedMotion ? 2400 : 1050;
  const dur = p.reducedMotion ? 100 : 460;

  function clearHoldTimer(): void {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function applySlide(i: number): void {
    const slide = slides[i]!;
    p.helloEl.textContent = slide.hello;
    p.helloEl.dir = slide.dir;
    p.helloEl.lang = slide.locale;
    p.labelEl.textContent = `${slide.flag} ${slide.label}`;
    p.onIndexChange(i, slide);
  }

  function scheduleNext(): void {
    clearHoldTimer();
    if (!running) return;
    holdTimer = setTimeout(() => {
      if (!running || animating) return;
      goTo((index + 1) % slides.length);
    }, holdMs);
  }

  function goTo(next: number): void {
    if (!running || animating || next === index) {
      scheduleNext();
      return;
    }
    animating = true;
    animate([p.helloEl, p.labelEl], {
      opacity: [1, 0],
      translateY: [0, -16],
      scale: [1, 0.94],
      duration: dur * 0.42,
      ease: 'inQuad',
      onComplete: () => {
        if (!running) {
          animating = false;
          return;
        }
        index = next;
        applySlide(index);
        animate([p.helloEl, p.labelEl], {
          opacity: [0, 1],
          translateY: [20, 0],
          scale: [0.9, 1],
          duration: dur * 0.58,
          ease: 'outQuad',
          onComplete: () => {
            animating = false;
            scheduleNext();
          },
        });
      },
    });
  }

  applySlide(index);
  p.helloEl.style.opacity = '1';
  p.labelEl.style.opacity = '1';
  scheduleNext();

  return {
    stop: () => {
      running = false;
      clearHoldTimer();
    },
  };
}
