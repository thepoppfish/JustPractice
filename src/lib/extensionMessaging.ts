import type { ExtensionMessage } from './messages';

export class ExtensionResponseError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

/** A rejected response is a failed operation, just like a rejected transport. */
export function requireOkResponse<T>(response: unknown): T {
  if (!response || typeof response !== 'object' || !('ok' in response) || response.ok !== true) {
    const error = response && typeof response === 'object' && 'error' in response
      ? String(response.error) : 'No valid response from the extension';
    throw new ExtensionResponseError(error, response && typeof response === 'object' && 'code' in response && typeof response.code === 'string' ? response.code : undefined);
  }
  return response as T;
}

export async function sendChecked<T>(message: ExtensionMessage): Promise<T> {
  return requireOkResponse<T>(await chrome.runtime.sendMessage(message));
}

/** Normalize errors from `chrome.runtime.sendMessage` (MV3 service worker / invalidated contexts). */

export function messagingFailureText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

export function isBenignExtensionMessagingFailure(err: unknown): boolean {
  const m = messagingFailureText(err).toLowerCase();
  return (
    m.includes('extension context invalidated') ||
    m.includes('receiving end does not exist') ||
    m.includes('could not establish connection') ||
    m.includes('message port closed') ||
    m.includes('the message port closed before a response was received')
  );
}
