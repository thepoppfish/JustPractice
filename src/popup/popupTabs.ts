/** Automatic-activation tabs, with one Tab stop and physical arrow navigation in either direction. */
export function attachPopupTabs(root: HTMLElement, onChange: (tab: string) => void): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  function activate(tab: HTMLButtonElement): void {
    tabs.forEach((button) => {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('active', selected);
      const panel = root.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`);
      if (panel) {
        panel.hidden = !selected;
        panel.classList.toggle('active', selected);
      }
    });
    onChange(tab.dataset.tab!);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      const rtl = getComputedStyle(tab).direction === 'rtl';
      let next: number;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else if (event.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
      else if (event.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
      else return;
      event.preventDefault();
      const target = tabs[(next + tabs.length) % tabs.length]!;
      activate(target);
      target.focus();
    });
  });
}
