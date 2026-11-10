import type { ExtensionMessage, ExtensionResponse } from '../lib/messages';
import { attachBackgroundContextMenuListeners } from './backgroundContextMenus';
import { attachBackgroundOnboardingListeners } from './backgroundOnboarding';
import { handleBackgroundMessage } from './backgroundMessageHandlers';

attachBackgroundContextMenuListeners();
attachBackgroundOnboardingListeners();

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (r: ExtensionResponse) => void,
  ) => {
    void (async () => {
      try {
        const r = await handleBackgroundMessage(message);
        sendResponse(r);
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return true;
  },
);
