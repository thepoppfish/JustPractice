/**
 * Completion celebration on the daily goal ring (Motivation #8, placement C).
 * Choreographed with anime.js; particle/ripple DOM via d3.
 */
import { animate, createTimeline, type JSAnimation, type Timeline } from 'animejs';
import * as d3 from 'd3';

const RING_CX = 18;
const RING_CY = 18;
const RING_R = 15.9155;
const SPARK_COUNT = 18;
const STAR_COUNT = 8;
const RIPPLE_COUNT = 3;

const SPARK_COLORS = ['#7dffa8', '#ffdd57', '#ff9b4a', '#ff6b26', '#b8ffd4', '#fff3a0'] as const;

export type BurstParticleSpec = { id: number; angle: number };

/** Evenly spaced burst angles (tests + spark layout). */
export function buildBurstParticleSpecs(count: number): BurstParticleSpec[] {
  return d3.range(count).map((i) => ({
    id: i,
    angle: (i / count) * Math.PI * 2,
  }));
}

let celebrationGeneration = 0;
let activeTimeline: Timeline | null = null;
let activeFgAnim: JSAnimation | null = null;

function bumpGeneration(): number {
  celebrationGeneration += 1;
  activeTimeline?.pause();
  activeFgAnim?.pause();
  activeTimeline = null;
  activeFgAnim = null;
  return celebrationGeneration;
}

function isStale(gen: number): boolean {
  return gen !== celebrationGeneration;
}

export function playDailyGoalRingCompleteCelebration(shadowRoot: ShadowRoot | null): void {
  if (!shadowRoot) return;
  const wrap = shadowRoot.querySelector<HTMLElement>('[part="daily-goal-ring"]');
  const fg = shadowRoot.querySelector<SVGCircleElement>('[part="daily-ring-fg"]');
  const label = shadowRoot.querySelector<HTMLElement>('[part="daily-ring-label"]');
  const fx = wrap?.querySelector<SVGSVGElement>('[part="daily-ring-fx"]');
  if (!wrap || !fg || !fx) return;

  const gen = bumpGeneration();
  clearFxLayer(fx);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  wrap.classList.add('daily-goal-ring--celebrate');

  const endCelebrate = () => {
    if (!isStale(gen)) wrap.classList.remove('daily-goal-ring--celebrate');
  };

  playRingPulse(wrap, reduced, gen, endCelebrate);
  playStrokeGlow(fg, reduced);

  if (label) playLabelPop(label, reduced);

  const root = d3
    .select(fx)
    .selectAll<SVGGElement, number>('g.daily-ring-celebration')
    .data([0])
    .join('g')
    .attr('class', 'daily-ring-celebration');

  playVictorySweep(root, reduced);
  playRipples(root, reduced);

  if (!reduced) {
    playSparkBurst(root);
    playCenterCheck(root);
  }

  window.setTimeout(() => {
    if (isStale(gen)) return;
    clearFxLayer(fx);
    endCelebrate();
  }, reduced ? 520 : 1650);
}

function playRingPulse(
  wrap: HTMLElement,
  reduced: boolean,
  gen: number,
  onDone: () => void,
): void {
  if (reduced) {
    activeTimeline = createTimeline({ onComplete: onDone })
      .add(wrap, { scale: [1, 1.08, 1], duration: 380, ease: 'outQuad' });
    return;
  }

  activeTimeline = createTimeline({ onComplete: () => {
    activeTimeline = null;
    if (!isStale(gen)) onDone();
  } })
    .add(wrap, { scale: [1, 0.86], duration: 95, ease: 'inQuad' })
    .add(wrap, { scale: [0.86, 1.22, 1.04, 1], duration: 720, ease: 'outElastic(1, .48)' })
    .add(wrap, { rotate: [0, -6, 5, -2, 0], duration: 420, ease: 'outQuad' }, 120);
}

function playStrokeGlow(fg: SVGCircleElement, reduced: boolean): void {
  activeFgAnim = animate(fg, {
    stroke: reduced
      ? ['#ff6b26', '#5bd47a', '#ff6b26']
      : ['#ff6b26', '#7dffa8', '#ffdd57', '#7dffa8', '#ff6b26'],
    strokeWidth: reduced ? ['3.2', '3.8', '3.2'] : ['3.2', '4.6', '3.6', '3.2'],
    duration: reduced ? 420 : 1200,
    ease: 'outSine',
    onComplete: () => {
      activeFgAnim = null;
    },
  });
}

function playLabelPop(label: HTMLElement, reduced: boolean): void {
  label.classList.add('daily-ring-label--pop');
  window.setTimeout(() => label.classList.remove('daily-ring-label--pop'), reduced ? 400 : 900);
}

function clearFxLayer(fx: SVGSVGElement): void {
  d3.select(fx).selectAll('g.daily-ring-celebration').remove();
}

function playVictorySweep(
  root: d3.Selection<SVGGElement, number, SVGSVGElement, unknown>,
  reduced: boolean,
): void {
  const sweep = root
    .append('circle')
    .attr('class', 'daily-ring-sweep')
    .attr('cx', RING_CX)
    .attr('cy', RING_CY)
    .attr('r', RING_R)
    .attr('fill', 'none')
    .attr('stroke', '#7dffa8')
    .attr('stroke-width', reduced ? 3.4 : 4.2)
    .attr('stroke-linecap', 'round')
    .attr('pathLength', '100')
    .attr('stroke-dasharray', '0 100')
    .attr('transform', 'rotate(-90 18 18)')
    .attr('opacity', 0.95);

  animate(sweep.node()!, {
    strokeDasharray: ['0 100', '100 100'],
    opacity: [0.95, 0.95, 0],
    duration: reduced ? 480 : 780,
    delay: reduced ? 0 : 60,
    ease: 'outCubic',
  });
}

function playRipples(
  root: d3.Selection<SVGGElement, number, SVGSVGElement, unknown>,
  reduced: boolean,
): void {
  const ripples = root
    .selectAll<SVGCircleElement, number>('circle.daily-ring-ripple')
    .data(d3.range(reduced ? 1 : RIPPLE_COUNT))
    .join('circle')
    .attr('class', 'daily-ring-ripple')
    .attr('cx', RING_CX)
    .attr('cy', RING_CY)
    .attr('r', RING_R)
    .attr('fill', 'none')
    .attr('stroke', '#7dffa8')
    .attr('stroke-width', 1.8)
    .attr('opacity', 0.55);

  ripples.each(function (_d, i) {
    animate(this, {
      r: [RING_R, RING_R + (reduced ? 5 : 9)],
      opacity: [0.5, 0],
      strokeWidth: [1.8, 0.4],
      duration: reduced ? 420 : 880,
      delay: i * (reduced ? 0 : 110),
      ease: 'outQuad',
    });
  });
}

function playSparkBurst(root: d3.Selection<SVGGElement, number, SVGSVGElement, unknown>): void {
  const specs = buildBurstParticleSpecs(SPARK_COUNT).map((s) => ({
    ...s,
    angle: s.angle + (Math.random() - 0.5) * 0.4,
    dist: 10 + Math.random() * 7,
    size: 0.7 + Math.random() * 0.5,
  }));

  const sparks = root
    .selectAll<SVGCircleElement, (typeof specs)[0]>('circle.daily-ring-spark')
    .data(specs, (d) => d.id)
    .join('circle')
    .attr('class', 'daily-ring-spark')
    .attr('cx', RING_CX)
    .attr('cy', RING_CY)
    .attr('r', (d) => d.size)
    .attr('fill', (_, i) => SPARK_COLORS[i % SPARK_COLORS.length])
    .attr('opacity', 1);

  sparks.nodes().forEach((node, i) => {
    const { angle, dist, size } = specs[i];
    const tx = RING_CX + Math.cos(angle) * dist;
    const ty = RING_CY + Math.sin(angle) * dist;
    animate(node, {
      cx: [RING_CX, tx],
      cy: [RING_CY, ty],
      opacity: [1, 0],
      r: [size, size * 0.15],
      duration: 620 + Math.random() * 280,
      delay: i * 14,
      ease: 'outExpo',
    });
  });

  const starPath = d3.symbol().type(d3.symbolStar).size(24);
  const starSpecs = buildBurstParticleSpecs(STAR_COUNT).map((s, i) => ({
    ...s,
    angle: s.angle + Math.PI / STAR_COUNT,
    dist: 8 + (i % 3) * 2.5,
  }));

  const starGroups = root
    .selectAll<SVGGElement, (typeof starSpecs)[0]>('g.daily-ring-star')
    .data(starSpecs, (d) => `star-${d.id}`)
    .join('g')
    .attr('class', 'daily-ring-star')
    .attr('transform', `translate(${RING_CX},${RING_CY}) scale(0.15)`);

  starGroups
    .append('path')
    .attr('d', starPath)
    .attr('fill', (_, i) => SPARK_COLORS[(i + 2) % SPARK_COLORS.length])
    .attr('opacity', 0.95);

  starGroups.nodes().forEach((node, i) => {
    const { angle, dist } = starSpecs[i];
    const tx = RING_CX + Math.cos(angle) * dist;
    const ty = RING_CY + Math.sin(angle) * dist;
    animate(node, {
      transform: [
        `translate(${RING_CX} ${RING_CY}) scale(0.15)`,
        `translate(${tx} ${ty}) scale(1.15)`,
        `translate(${tx} ${ty}) scale(0.2)`,
      ],
      opacity: [0.95, 0.9, 0],
      duration: 750,
      delay: 100 + i * 38,
      ease: 'outExpo',
    });
  });
}

function playCenterCheck(root: d3.Selection<SVGGElement, number, SVGSVGElement, unknown>): void {
  const check = root
    .append('path')
    .attr('class', 'daily-ring-check')
    .attr('d', 'M 12.8 18.2 L 15.8 21.2 L 23.2 13.6')
    .attr('fill', 'none')
    .attr('stroke', '#7dffa8')
    .attr('stroke-width', 2.4)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('pathLength', '100')
    .attr('stroke-dasharray', '0 100')
    .attr('opacity', 0);

  animate(check.node()!, {
    strokeDasharray: ['0 100', '100 100'],
    opacity: [0, 1, 1, 0],
    duration: 720,
    delay: 140,
    ease: 'outCubic',
  });
}
