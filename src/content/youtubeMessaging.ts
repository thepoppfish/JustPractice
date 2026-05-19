import type { ExtensionMessage } from '../lib/messages';
import { isBenignExtensionMessagingFailure, messagingFailureText } from '../lib/extensionMessaging';

/** Fire-and-forget async UI handlers (void foo() would leave rejections uncaught). */
export function fireAsyncWatch(p: Promise<unknown>): void {
  void p.catch((err) => {
    if (isBenignExtensionMessagingFailure(err)) return;
    console.warn('[JustPractice:watch] async handler failed', err);
  });
}

export async function sendMsg<T = unknown>(msg: ExtensionMessage): Promise<T> {
  try {
    return (await chrome.runtime.sendMessage(msg)) as T;
  } catch (e) {
    if (isBenignExtensionMessagingFailure(e)) {
      console.warn('[JustPractice:watch] Extension messaging unavailable; refresh this YouTube tab.', messagingFailureText(e));
      return { ok: false, error: messagingFailureText(e) } as T;
    }
    throw e;
  }
}

export function sendMsgFireAndForget(msg: ExtensionMessage): void {
  void sendMsg(msg).catch((err) => {
    if (!isBenignExtensionMessagingFailure(err)) {
      console.warn('[JustPractice:watch] sendMessage failed', err);
    }
  });
}
