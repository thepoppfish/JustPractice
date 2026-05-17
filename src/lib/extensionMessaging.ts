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
