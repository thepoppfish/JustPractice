// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { attachYearHeatmapInteractive } from './yearHeatmapInteractive';

let detach: () => void;
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = `<main data-year-hm-root>
    <div data-year-hm-nav-year>2026</div><div data-year-hm-nav-month hidden><button data-year-hm-back>Back</button></div>
    <div data-year-hm-keys>Legend</div><div data-year-hm-stage>
      <div data-year-hm-year-layer><div class="year-hm-cells">
        <button data-date="2026-11-08">8</button><button class="year-hm-cell--today" data-date="2026-11-09">9</button><button data-date="2026-11-10">10</button>
      </div></div><div data-year-hm-month-layer hidden></div>
    </div></main>`;
  root = document.querySelector('main')!;
  detach = attachYearHeatmapInteractive({
    root, locale: 'he', variant: 'dashboard', getYear: () => 2026,
    getData: () => ({ dailySeconds: { '2026-11-09': 120 }, extensionInstalledDateKey: '2026-01-01', dailyGoalSec: 600, monthlyGoalSec: null }),
    statusLabel: (display, date, seconds) => `${date}: ${display}, ${seconds}s`,
    backToYearLabel: 'Back', navPrevMonthLabel: 'Previous month', navNextMonthLabel: 'Next month', formatMonthTotal: String,
  });
});
afterEach(() => { detach(); document.body.innerHTML = ''; });

it('has one year-calendar Tab stop and restores it after a keyboard month visit', () => {
  const days = [...root.querySelectorAll<HTMLButtonElement>('button[data-date]')];
  expect(days.map(d => d.tabIndex)).toEqual([-1, 0, -1]);
  days[1].focus();
  days[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(document.activeElement).toBe(days[0]);
  days[0].click();
  expect(document.activeElement).toBe(root.querySelector('[data-year-hm-month-slot="center"] h3'));
  root.querySelector<HTMLButtonElement>('[data-year-hm-back]')!.click();
  expect(document.activeElement).toBe(days[0]);
  expect(days.map(d => d.tabIndex)).toEqual([0, -1, -1]);
});

it('renders a static month table with rows, localized column headers and day summaries', () => {
  root.querySelector<HTMLButtonElement>('[data-date="2026-11-09"]')!.click();
  const table = root.querySelector('[data-year-hm-month-slot="center"] [role="table"]')!;
  expect(table.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
  expect(table.querySelector('[role="columnheader"]')?.textContent).toBe(new Intl.DateTimeFormat('he', { weekday: 'narrow' }).format(new Date(2024, 0, 7)));
  expect(table.querySelectorAll('[role="rowgroup"] > [role="row"]').length).toBeGreaterThanOrEqual(4);
  expect(table.querySelector('[data-date="2026-11-09"]')?.getAttribute('aria-label')).toContain('120s');
  expect(root.querySelector('[role="gridcell"]')).toBeNull();
});

it('keeps month navigation focused and handles the final-month boundary', () => {
  root.querySelector<HTMLButtonElement>('[data-date="2026-11-09"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-year-hm-month-next]')!.click();
  expect(root.querySelector<HTMLButtonElement>('[data-year-hm-month-next]')!.disabled).toBe(true);
  expect(document.activeElement).toBe(root.querySelector('[data-year-hm-month-slot="center"] h3'));
  root.querySelector<HTMLButtonElement>('[data-year-hm-month-prev]')!.click();
  expect(document.activeElement).toBe(root.querySelector('[data-year-hm-month-prev]'));
});
