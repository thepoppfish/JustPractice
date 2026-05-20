import type { ExtensionMessage, ExtensionResponse } from '../lib/messages';
import {
  ensureGoalCheckAlarm,
  onGoalAlarmName,
  runPeriodicGoalChecks,
} from '../lib/goalNotifications';
import { attachBackgroundContextMenuListeners } from './backgroundContextMenus';
import { handleBackgroundMessage } from './backgroundMessageHandlers';

attachBackgroundContextMenuListeners();
void ensureGoalCheckAlarm();

chrome.alarms.onAlarm.addListener((a) => {
  if (onGoalAlarmName(a.name)) void runPeriodicGoalChecks();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureGoalCheckAlarm();
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
