import type { ExtensionMessage, ExtensionResponse } from '../lib/messages';
import { attachBackgroundContextMenuListeners } from './backgroundContextMenus';
import { attachBackgroundOnboardingListeners } from './backgroundOnboarding';
import { handleBackgroundMessage } from './backgroundMessageHandlers';

const LEGACY_GOAL_ALARM = 'jp-practice-goal-checks';

attachBackgroundContextMenuListeners();
attachBackgroundOnboardingListeners();

/** Drop legacy goal-reminder alarm (feature removed). */
void chrome.alarms.clear(LEGACY_GOAL_ALARM);

chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.clear(LEGACY_GOAL_ALARM);
});

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
