/**
 * Roadmap completion overlay (R2) — anime.js choreography on the dashboard trail.
 */
import { animate, createTimeline, type Timeline } from 'animejs';

const SPARK_COLORS = ['#7dffa8', '#ffdd57', '#ff9b4a', '#ff6b26', '#b8ffd4', '#fff3a0'] as const;
const NODE_STAGGER_MS = 80;
const FULL_DURATION_MS = 2400;
const REDUCED_DURATION_MS = 520;

export interface PlayRoadmapCelebrationOptions {
  title: string;
  subtitle: string;
  skipLabel: string;
  onComplete: () => void;
}

let celebrationGeneration = 0;
let activeTimeline: Timeline | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let activeLayer: HTMLElement | null = null;
let activeOnComplete: (() => void) | null = null;

function bumpGeneration(): number {
  celebrationGeneration += 1;
  activeTimeline?.pause();
  if (settleTimer != null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  activeTimeline = null;
  return celebrationGeneration;
}

function isStale(gen: number): boolean {
  return gen !== celebrationGeneration;
}

function finishCelebration(gen: number, layer: HTMLElement): void {
  if (isStale(gen)) return;
  layer.classList.remove('path-celebration-layer--active');
  layer.setAttribute('hidden', '');
  layer.querySelectorAll('.path-celebration-spark').forEach((el) => el.remove());
  const done = activeOnComplete;
  activeOnComplete = null;
  activeLayer = null;
  done?.();
}

export function cancelRoadmapCompletionCelebration(): void {
  const gen = bumpGeneration();
  if (activeLayer) finishCelebration(gen, activeLayer);
}

export function playRoadmapCompletionCelebration(
  section: HTMLElement,
  options: PlayRoadmapCelebrationOptions,
): void {
  const layer = section.querySelector<HTMLElement>('.path-celebration-layer');
  const canvas = section.querySelector<HTMLElement>('.path-canvas');
  if (!layer || !canvas) return;

  const gen = bumpGeneration();
  activeLayer = layer;
  activeOnComplete = options.onComplete;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const titleEl = layer.querySelector<HTMLElement>('.path-celebration-title');
  const subEl = layer.querySelector<HTMLElement>('.path-celebration-sub');
  const vignette = layer.querySelector<HTMLElement>('.path-celebration-vignette');
  const headline = layer.querySelector<HTMLElement>('.path-celebration-headline');
  const skipBtn = layer.querySelector<HTMLButtonElement>('.path-celebration-skip');
  const particleHost = layer.querySelector<HTMLElement>('.path-celebration-particles');

  if (titleEl) titleEl.textContent = options.title;
  if (subEl) subEl.textContent = options.subtitle;
  if (skipBtn) skipBtn.textContent = options.skipLabel;

  const nodes = [...section.querySelectorAll<HTMLElement>('.path-trail-item .path-node')];
  const skip = () => finishCelebration(gen, layer);
  skipBtn?.addEventListener(
    'click',
    () => {
      skip();
    },
    { once: true },
  );

  layer.removeAttribute('hidden');
  layer.classList.add('path-celebration-layer--active');
  layer.setAttribute('aria-hidden', 'false');

  nodes.forEach((node) => {
    const ring = node.querySelector<HTMLElement>('.path-node-ring');
    if (ring) ring.style.setProperty('--path-progress', '0');
  });

  if (reduced) {
    nodes.forEach((node) => {
      const ring = node.querySelector<HTMLElement>('.path-node-ring');
      if (ring) ring.style.setProperty('--path-progress', '100');
      node.classList.add('path-node--celebrate-pulse');
    });
    if (vignette) vignette.style.opacity = '0.85';
    if (headline) {
      headline.style.opacity = '1';
      headline.style.transform = 'translateY(0)';
    }
    settleTimer = setTimeout(() => {
      nodes.forEach((n) => n.classList.remove('path-node--celebrate-pulse'));
      finishCelebration(gen, layer);
    }, REDUCED_DURATION_MS);
    return;
  }

  if (vignette) vignette.style.opacity = '0';
  if (headline) {
    headline.style.opacity = '0';
    headline.style.transform = 'translateY(12px)';
  }

  activeTimeline = createTimeline();

  if (vignette) {
    activeTimeline.add(vignette, {
      opacity: [0, 0.92],
      duration: 220,
      ease: 'outQuad',
    });
  }

  if (headline) {
    activeTimeline.add(
      headline,
      {
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 420,
        ease: 'outCubic',
      },
      180,
    );
  }

  nodes.forEach((node, i) => {
    const ring = node.querySelector<HTMLElement>('.path-node-ring');
    const delay = 400 + i * NODE_STAGGER_MS;
    activeTimeline!.add(
      node,
      {
        scale: [1, 1.08, 1],
        duration: 480,
        ease: 'outElastic(1, .55)',
      },
      delay,
    );
    if (ring) {
      animate(ring, {
        '--path-progress': [0, 100],
        duration: 420,
        delay,
        ease: 'outCubic',
      });
    }
    const badge = node.querySelector<HTMLElement>('.path-node-done-badge');
    if (badge) {
      activeTimeline!.add(
        badge,
        {
          scale: [0.4, 1.15, 1],
          opacity: [0, 1],
          duration: 380,
          ease: 'outElastic(1, .6)',
        },
        delay + 60,
      );
    }
  });

  if (particleHost && nodes.length > 0) {
    const anchor = nodes[nodes.length - 1]!;
    const canvasRect = canvas.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const cx = anchorRect.left + anchorRect.width / 2 - canvasRect.left;
    const cy = anchorRect.top + anchorRect.height / 2 - canvasRect.top;
    spawnSparks(particleHost, cx, cy, gen);
  }

  const totalMs = FULL_DURATION_MS;
  settleTimer = setTimeout(() => finishCelebration(gen, layer), totalMs);
}

function spawnSparks(host: HTMLElement, cx: number, cy: number, gen: number): void {
  const count = 16;
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('span');
    el.className = 'path-celebration-spark';
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.background = SPARK_COLORS[i % SPARK_COLORS.length]!;
    host.appendChild(el);
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const dist = 28 + Math.random() * 48;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const size = 5 + Math.random() * 5;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    animate(el, {
      translateX: [0, tx],
      translateY: [0, ty],
      opacity: [1, 0],
      scale: [1, 0.2],
      duration: 620 + Math.random() * 280,
      delay: 560 + i * 18,
      ease: 'outExpo',
      onComplete: () => {
        if (!isStale(gen)) el.remove();
      },
    });
  }
}
