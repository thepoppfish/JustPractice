import { MSG } from './messages';
import { LIBRARY_UNDO_KEY, type LibraryUndoOffer } from './libraryUndo';
import { ExtensionResponseError, sendChecked } from './extensionMessaging';
import { uiActionFeedback } from './uiActionFeedback';

type Translate = (key: string, params?: Record<string, string | number>) => string;
const instances = new WeakMap<HTMLElement, LibraryUndoUi>();

/** One persistent, dismissible recovery offer shared by extension views. */
export class LibraryUndoUi {
  private offer: LibraryUndoOffer | null = null;
  private pending = false;
  private success = false;
  private failure = '';
  private generation = 0;
  private focusUndoRequested = false;
  private refreshQueued = false;
  private box = document.createElement('div');
  private message = document.createElement('p');
  private title = document.createElement('bdi');
  private error = document.createElement('p');
  private undo = document.createElement('button');
  private dismiss = document.createElement('button');

  constructor(private root: HTMLElement, private t: Translate, private changed: () => void | Promise<void>) {
    this.box.className = 'jp-library-undo';
    this.box.setAttribute('role', 'status');
    this.box.setAttribute('aria-live', 'polite');
    this.box.hidden = true;
    this.title.className = 'jp-library-undo-title';
    this.title.dir = 'auto';
    this.error.className = 'jp-library-undo-error';
    this.undo.type = this.dismiss.type = 'button';
    this.undo.dataset.undoRemoval = '';
    this.dismiss.dataset.dismissUndo = '';
    const buttons = document.createElement('div');
    buttons.className = 'jp-library-undo-actions';
    buttons.append(this.undo, this.dismiss);
    this.box.append(this.message, this.title, this.error, buttons);
    document.body.append(this.box);
    this.undo.addEventListener('click', () => { void this.apply(); });
    this.dismiss.addEventListener('click', () => { void this.close(); });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if ((area === 'session' && changes[LIBRARY_UNDO_KEY]) || (area === 'local' && changes.jpPractice)) void this.refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    const observer = new MutationObserver(() => this.render());
    observer.observe(root, { attributes: true, attributeFilter: ['aria-busy'] });
    const resized = () => this.updateTitleFocus();
    window.addEventListener('resize', resized);
    window.addEventListener('pagehide', () => {
      chrome.storage.onChanged.removeListener(listener);
      observer.disconnect();
      window.removeEventListener('resize', resized);
    }, { once: true });
    void this.refresh();
  }

  update(t: Translate, changed: () => void | Promise<void>): void { this.t = t; this.changed = changed; this.render(); }

  removed(offer: LibraryUndoOffer | null): void {
    this.generation++;
    this.offer = offer;
    this.success = false;
    this.failure = '';
    this.focusUndoRequested = Boolean(offer);
    this.render();
  }

  private render(): void {
    this.box.hidden = !this.offer && !this.success && !this.failure;
    document.body.classList.toggle('has-library-undo', !this.box.hidden);
    this.message.textContent = this.failure && !this.offer ? '' : this.t(this.success ? 'library.restored' : 'library.removed');
    if (this.offer) this.title.textContent = this.offer.title;
    this.error.textContent = this.failure ? this.t(this.failure) : '';
    this.error.hidden = !this.failure;
    this.undo.textContent = this.t('library.undo');
    this.undo.setAttribute('aria-label', `${this.t('library.undo')}: ${this.title.textContent}`);
    this.dismiss.textContent = this.t('library.dismiss');
    this.undo.hidden = !this.offer;
    const busy = this.pending || uiActionFeedback(this.root, this.t).pending;
    this.undo.disabled = this.dismiss.disabled = busy;
    this.updateTitleFocus();
    if (!busy && this.offer && this.focusUndoRequested) {
      this.focusUndoRequested = false;
      this.undo.focus({ preventScroll: true });
    }
  }

  private updateTitleFocus(): void {
    this.title.tabIndex = this.title.scrollHeight > this.title.clientHeight ? 0 : -1;
  }

  async refresh(): Promise<void> {
    if (this.pending) { this.refreshQueued = true; return; }
    const gen = ++this.generation;
    try {
      const result = await sendChecked<{ ok: true; undo: LibraryUndoOffer | null }>({ type: MSG.GET_LIBRARY_UNDO });
      if (gen !== this.generation || this.pending) return;
      const next = result.undo ?? null;
      const changed = next?.token !== this.offer?.token;
      this.offer = next;
      if (this.offer) this.success = false;
      if (changed) this.failure = '';
      this.render();
    } catch { /* A failed initial read must not claim there is an undo offer. */ }
  }

  private async apply(): Promise<void> {
    const actions = uiActionFeedback(this.root, this.t);
    if (!this.offer || this.pending || actions.pending) return;
    const token = this.offer.token;
    this.pending = true;
    this.generation++;
    this.render();
    await actions.run(this.root, async () => {
      try {
        await sendChecked({ type: MSG.UNDO_LIBRARY_REMOVAL, payload: { token } });
        this.offer = null;
        this.success = true;
        this.failure = '';
        await this.changed();
      } catch (error) {
        this.failure = error instanceof ExtensionResponseError && error.code === 'undo_unavailable' ? 'library.undoUnavailable' : 'library.undoFailed';
        if (this.failure === 'library.undoUnavailable') this.offer = null;
      }
    }, () => { void this.apply(); });
    this.pending = false;
    this.render();
    if (!this.offer) this.dismiss.focus({ preventScroll: true });
    this.flushRefresh();
  }

  private async close(): Promise<void> {
    if (this.pending || uiActionFeedback(this.root, this.t).pending) return;
    const focused = this.box.contains(document.activeElement);
    this.pending = true;
    this.generation++;
    this.render();
    try {
      if (this.offer) await sendChecked({ type: MSG.DISMISS_LIBRARY_UNDO, payload: { token: this.offer.token } });
      this.offer = null; this.success = false; this.failure = ''; this.render();
      if (focused) {
        const next = this.root.querySelector<HTMLElement>('.view--active h2, #popup-search');
        if (next) { if (next.matches('h2')) next.tabIndex = -1; next.focus({ preventScroll: true }); }
      }
    } catch { this.failure = 'library.undoFailed'; }
    finally { this.pending = false; this.render(); this.flushRefresh(); }
  }

  private flushRefresh(): void {
    if (!this.refreshQueued) return;
    this.refreshQueued = false;
    void this.refresh();
  }
}

export function libraryUndoUi(root: HTMLElement, t: Translate, changed: () => void | Promise<void>): LibraryUndoUi {
  let instance = instances.get(root);
  if (!instance) { instance = new LibraryUndoUi(root, t, changed); instances.set(root, instance); }
  else instance.update(t, changed);
  return instance;
}
