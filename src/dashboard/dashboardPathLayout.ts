/** Cubic connector between two path node centers (Duolingo-style zig-zag). */
export function buildConnectorBezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dy = to.y - from.y;
  const bend = Math.max(28, Math.min(96, Math.abs(dy) * 0.42));
  const c1y = from.y + bend;
  const c2y = to.y - bend;
  return `M ${from.x} ${from.y} C ${from.x} ${c1y}, ${to.x} ${c2y}, ${to.x} ${to.y}`;
}

type ConnectorTone = 'done' | 'active' | 'upcoming';

function connectorTone(node: Element): ConnectorTone {
  if (node.classList.contains('path-node--stepCompleted')) return 'done';
  if (node.classList.contains('path-node--active')) return 'active';
  return 'upcoming';
}

function layoutPathTrailConnectors(canvas: HTMLElement): void {
  const svg = canvas.querySelector<SVGSVGElement>('.path-connectors');
  const nodes = canvas.querySelectorAll<HTMLElement>('.path-trail-item .path-node');
  if (!svg) return;

  if (nodes.length < 2) {
    svg.innerHTML = '';
    svg.removeAttribute('viewBox');
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(canvasRect.width));
  const h = Math.max(1, Math.round(canvasRect.height));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));

  const points = Array.from(nodes).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - canvasRect.left,
      y: r.top + r.height / 2 - canvasRect.top,
      tone: connectorTone(el),
    };
  });

  const paths: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const d = buildConnectorBezierPath(a, b);
    const tone = a.tone === 'done' ? 'done' : a.tone === 'active' ? 'active' : 'upcoming';
    paths.push(
      `<path class="path-connector path-connector--${tone}" d="${d}" fill="none" vector-effect="non-scaling-stroke" />`,
    );
  }

  svg.innerHTML = paths.join('');
}

const layoutObserverKey = Symbol('pathTrailLayoutObserver');

export function refreshPathTrailLayout(root: HTMLElement): void {
  requestAnimationFrame(() => {
    const canvas = root.querySelector<HTMLElement>('.path-canvas');
    if (!canvas) return;

    layoutPathTrailConnectors(canvas);

    const prev = (canvas as HTMLElement & { [layoutObserverKey]?: ResizeObserver })[layoutObserverKey];
    prev?.disconnect();

    const ro = new ResizeObserver(() => layoutPathTrailConnectors(canvas));
    (canvas as HTMLElement & { [layoutObserverKey]?: ResizeObserver })[layoutObserverKey] = ro;
    ro.observe(canvas);

    canvas.querySelectorAll<HTMLImageElement>('.path-node-thumb').forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', () => layoutPathTrailConnectors(canvas), { once: true });
    });
  });
}
