import { MSG, type ExtensionMessage } from './messages';
import { isBenignExtensionMessagingFailure, messagingFailureText, requireOkResponse } from './extensionMessaging';

type Translate = (key: string) => string;
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Sender = <T>(message: ExtensionMessage) => Promise<T>;
type ControlValue = string | boolean;
interface Source {
  find: () => HTMLElement | null;
  key: string;
}
interface ActionError {
  source: Source;
  messageKey: string;
  node: HTMLElement;
}

const instances = new WeakMap<HTMLElement, UiActionFeedback>();
let nextId = 0;

function controlKey(control: Control): string | null {
  if (control.id) return `id:${control.id}`;
  if (control.getAttribute('part')) return `part:${control.getAttribute('part')}`;
  return null;
}

function valueOf(control: Control, original = false): ControlValue {
  if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) {
    return original ? control.defaultChecked : control.checked;
  }
  if (control instanceof HTMLSelectElement && original) {
    return [...control.options].find((option) => option.defaultSelected)?.value ?? control.options[0]?.value ?? '';
  }
  return original && 'defaultValue' in control ? control.defaultValue : control.value;
}

/** User-action feedback and unsaved controls survive ordinary storage-driven paints. */
export class UiActionFeedback {
  private t: Translate;
  private drafts = new Map<string, ControlValue>();
  private errors = new Map<string, ActionError>();
  private disabled = new Map<HTMLButtonElement | Control, boolean>();
  private status: HTMLElement;
  private written = false;
  private successKey = 'feedback.saved';
  private silent = false;
  private activeSource: HTMLElement | null = null;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  pending = false;

  constructor(private root: HTMLElement, t: Translate) {
    this.t = t;
    this.status = document.createElement('div');
    this.status.className = 'jp-action-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.hidden = true;
    const tree = root.getRootNode();
    (tree instanceof ShadowRoot ? tree : document.body).append(this.status);
  }

  setTranslator(t: Translate): void {
    this.t = t;
    for (const error of this.errors.values()) {
      error.node.querySelector('p')!.textContent = t(error.messageKey);
      error.node.querySelector('button')!.textContent = t('feedback.retry');
    }
  }

  acknowledge(key = 'feedback.saved'): void {
    this.written = true;
    this.successKey = key;
    this.commitActiveControls();
  }

  silenceSuccess(): void { this.silent = true; }

  reset(): void {
    this.generation++;
    this.drafts.clear();
    for (const key of this.errors.keys()) this.clearError(key);
    this.status.hidden = true;
    clearTimeout(this.timer);
  }

  sender(transport: Sender): Sender {
    return async <T>(message: ExtensionMessage): Promise<T> => {
      if (message.type !== MSG.GET_STATE) this.written = true;
      const response = requireOkResponse<T>(await transport<unknown>(message));
      if (message.type !== MSG.GET_STATE) this.commitActiveControls();
      return response;
    };
  }

  private committedControls(source: HTMLElement): Control[] {
    const ids = (source.dataset.commitControls ?? '').split(/\s+/).filter(Boolean);
    const parts = (source.dataset.commitParts ?? '').split(/\s+/).filter(Boolean);
    return [...this.root.querySelectorAll<Control>('input, select, textarea')].filter((control) =>
      control === source || ids.includes(control.id) || parts.includes(control.getAttribute('part') ?? ''),
    );
  }

  private commitActiveControls(): void {
    if (!this.activeSource) return;
    const controls = this.committedControls(this.source(this.activeSource).find() ?? this.activeSource);
    for (const control of controls) {
      const key = controlKey(control);
      if (key) this.drafts.delete(key);
      const value = valueOf(control);
      if (control instanceof HTMLInputElement && typeof value === 'boolean') control.defaultChecked = value;
      else if (control instanceof HTMLSelectElement) {
        for (const option of control.options) option.defaultSelected = option.value === value;
        control.value = String(value);
      } else if ('defaultValue' in control) control.defaultValue = String(value);
      for (const [errorKey, error] of this.errors) {
        const source = error.source.find();
        if (source && this.committedControls(source).includes(control)) this.clearError(errorKey);
      }
    }
  }

  captureDrafts(): void {
    this.root.querySelectorAll<Control>('input:not([type="search"]):not([type="file"]), select, textarea').forEach((control) => {
      const key = controlKey(control);
      if (!key) return;
      const value = valueOf(control);
      if (value === valueOf(control, true)) this.drafts.delete(key);
      else this.drafts.set(key, value);
    });
  }

  restore(): void {
    this.root.querySelectorAll<Control>('input, select, textarea').forEach((control) => {
      const key = controlKey(control);
      if (!key || !this.drafts.has(key)) return;
      const value = this.drafts.get(key)!;
      if (valueOf(control, true) === value) this.drafts.delete(key);
      else if (typeof value === 'boolean' && control instanceof HTMLInputElement) control.checked = value;
      else control.value = String(value);
    });
    for (const error of this.errors.values()) this.placeError(error);
    if (this.pending) this.disableControls();
  }

  private source(element: HTMLElement): Source {
    if (element === this.root) return { key: 'root', find: () => this.root.isConnected ? this.root : null };
    for (const attribute of ['id', 'data-remove', 'data-undo-complete', 'data-path-action', 'data-path-bonus-pick', 'data-custom-message-index', 'part']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      return {
        key: `${attribute}:${value}`,
        find: () => [...this.root.querySelectorAll<HTMLElement>(`[${attribute}]`)].find((node) => node.getAttribute(attribute) === value) ?? null,
      };
    }
    return { key: element.dataset.jpActionKey ??= `action-${++nextId}`, find: () => element.isConnected ? element : null };
  }

  private disableControls(): void {
    this.root.setAttribute('aria-busy', 'true');
    this.root.querySelectorAll<HTMLButtonElement | Control>('button, input, select, textarea').forEach((control) => {
      if (!this.disabled.has(control)) this.disabled.set(control, control.disabled);
      control.disabled = true;
    });
  }

  private statusText(text: string): void {
    clearTimeout(this.timer);
    this.status.textContent = text;
    this.status.hidden = false;
  }

  private placeError(error: ActionError): void {
    const source = error.source.find();
    if (!source) return;
    if (source === this.root) {
      if (!error.node.isConnected) (this.root.querySelector('.content, main') ?? this.root).prepend(error.node);
      return;
    }
    const anchor = source.closest('.settings-block, .welcome-actions, .item, .card, .goals-targets') ?? source.parentElement ?? source;
    if (!error.node.isConnected) {
      if (anchor === this.root) this.root.append(error.node);
      else anchor.insertAdjacentElement('afterend', error.node);
    }
    const described = new Set((source.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    described.add(error.node.id);
    source.setAttribute('aria-describedby', [...described].join(' '));
  }

  private clearError(key: string): void {
    const error = this.errors.get(key);
    if (!error) return;
    const source = error.source.find();
    if (source) {
      const ids = (source.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== error.node.id);
      if (ids.length) source.setAttribute('aria-describedby', ids.join(' '));
      else source.removeAttribute('aria-describedby');
    }
    error.node.remove();
    this.errors.delete(key);
  }

  private showError(source: Source, error: unknown, retry: () => void): void {
    this.clearError(source.key);
    const reason = messagingFailureText(error).toLowerCase();
    const key = isBenignExtensionMessagingFailure(error) ? 'feedback.reconnect'
      : /quota|storage.*full|exceeded/.test(reason) ? 'feedback.quota' : 'feedback.failed';
    const node = document.createElement('div');
    node.className = 'jp-action-error';
    node.id = `jp-action-error-${++nextId}`;
    node.setAttribute('role', 'alert');
    const text = document.createElement('p');
    text.textContent = this.t(key);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = this.t('feedback.retry');
    button.addEventListener('click', retry);
    node.append(text, button);
    const entry = { source, messageKey: key, node };
    this.errors.set(source.key, entry);
    this.placeError(entry);
  }

  report(error: unknown, retry: () => void | Promise<void>): void {
    const repeat = () => { void this.run(this.root, async () => { await retry(); this.acknowledge(); }, repeat); };
    this.showError(this.source(this.root), error, repeat);
  }

  /** The complete operation stops on failure; callers never refresh from a rejected write. */
  async run(element: HTMLElement, operation: () => void | Promise<void>, retry: () => void): Promise<boolean> {
    if (this.pending) return false;
    const source = this.source(element);
    const initialError = this.errors.get(source.key);
    const generation = this.generation;
    const tree = this.root.getRootNode();
    const focused = tree instanceof ShadowRoot ? tree.activeElement : document.activeElement;
    const focusSource = focused instanceof HTMLElement && this.root.contains(focused) ? this.source(focused) : null;
    const selection = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
      ? [focused.selectionStart, focused.selectionEnd] : null;
    this.captureDrafts();
    this.pending = true;
    this.activeSource = element;
    this.written = false;
    this.successKey = 'feedback.saved';
    this.silent = false;
    try {
      const result = operation();
      if (result instanceof Promise) {
        this.disableControls();
        this.statusText(this.t('feedback.working'));
        await result;
      }
      if (generation !== this.generation) return false;
      this.captureDrafts();
      if (this.written && this.errors.get(source.key) === initialError) this.clearError(source.key);
      if (this.written && !this.silent && !this.errors.has(source.key)) {
        this.statusText(this.t(this.successKey));
        this.timer = setTimeout(() => { this.status.hidden = true; }, 3500);
      } else this.status.hidden = true;
      return true;
    } catch (error) {
      if (generation === this.generation) {
        this.captureDrafts();
        this.status.hidden = true;
        this.showError(source, error, retry);
      }
      return false;
    } finally {
      this.pending = false;
      this.activeSource = null;
      this.root.removeAttribute('aria-busy');
      for (const [control, disabled] of this.disabled) control.disabled = disabled;
      this.disabled.clear();
      this.restore();
      const active = tree instanceof ShadowRoot ? tree.activeElement : document.activeElement;
      const next = focusSource?.find() ?? (focusSource ? source.find() : null);
      if (generation === this.generation && next && (!active || active === document.body) && !next.closest('[hidden], .view--hidden')) {
        next.focus({ preventScroll: true });
        if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) && selection?.[0] != null) {
          next.setSelectionRange(selection[0], selection[1]);
        }
      }
    }
  }

  /** Replay the event on its current control, so a retry reads the latest retained input. */
  handle(event: Event, operation: () => void | Promise<void>): void {
    const element = event.currentTarget as HTMLElement;
    const source = this.source(element);
    const replay = () => {
      const current = source.find();
      if (!current) return;
      const next = event instanceof KeyboardEvent
        ? new KeyboardEvent(event.type, { key: event.key, bubbles: true, cancelable: true })
        : new Event(event.type, { bubbles: true, cancelable: true });
      current.dispatchEvent(next);
    };
    void this.run(element, operation, replay);
  }
}

export function uiActionFeedback(root: HTMLElement, t: Translate): UiActionFeedback {
  let instance = instances.get(root);
  if (!instance) { instance = new UiActionFeedback(root, t); instances.set(root, instance); }
  instance.setTranslator(t);
  return instance;
}
