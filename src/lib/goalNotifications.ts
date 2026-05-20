import notifyAssetUrl from '../assets/notify.png?url';
import { APP_NAME } from './branding';
import { createTranslator, resolveLocale } from '../i18n';
import {
  dateKeyFromTimestamp,
  ensureSettingsShape,
  readPersisted,
  writePersisted,
  type PersistedData,
} from './storage';
import { awardDailyGoalXpBonus } from './playerProgress';
import { processDailyGoalXpEvent } from './playerProgressEvents';
import { formatDuration } from './practiceStats';
import { evaluateAchievements } from './achievements';

/** Resolved URL or data URL for `chrome.notifications` (packaged asset or Vite-inlined PNG). */
export function notificationIconUrl(): string {
  if (notifyAssetUrl.startsWith('data:')) return notifyAssetUrl;
  const path = notifyAssetUrl.startsWith('/') ? notifyAssetUrl.slice(1) : notifyAssetUrl;
  return chrome.runtime.getURL(path);
}

const ALARM_GOAL_CHECKS = 'jp-practice-goal-checks';

/** Period for checking evening nudge + catching missed “goal met” notifications */
export const GOAL_CHECK_ALARM_PERIOD_MIN = 30;

export async function ensureGoalCheckAlarm(): Promise<void> {
  await chrome.alarms.create(ALARM_GOAL_CHECKS, { periodInMinutes: GOAL_CHECK_ALARM_PERIOD_MIN });
}

export function onGoalAlarmName(name: string): boolean {
  return name === ALARM_GOAL_CHECKS;
}

function canNotify(p: PersistedData): boolean {
  return p.settings.goalNotificationsEnabled === true;
}

/**
 * Manifest already includes `notifications`; `contains` stays for defensive checks.
 */
async function notificationsGranted(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['notifications'] });
  } catch {
    return false;
  }
}

function nudgeHour(p: PersistedData): number {
  const h = p.settings.goalNudgeHourLocal;
  if (h === null || h === undefined) return 20;
  if (typeof h !== 'number' || !Number.isFinite(h)) return 20;
  return Math.min(23, Math.max(0, Math.round(h)));
}

function notifyT(p: PersistedData): ReturnType<typeof createTranslator> {
  const s = ensureSettingsShape(p.settings);
  return createTranslator(resolveLocale(s.uiLocale));
}

/**
 * Award daily-goal XP and scan achievements when the daily target is met (idempotent per day).
 * Persists when progress changes.
 */
export async function syncDailyGoalXpFromPersisted(p: PersistedData): Promise<void> {
  const todayKey = dateKeyFromTimestamp(Date.now());
  const target = p.settings.goals?.dailyTargetSec;
  if (target === null || target === undefined || target <= 0) return;
  if ((p.dailySeconds[todayKey] ?? 0) < target) return;

  const xpBefore = p.playerProgress.totalXp;
  const achBefore = Object.keys(p.playerProgress.achievements).length;
  awardDailyGoalXpBonus(p.playerProgress, todayKey);
  evaluateAchievements(p, p.playerProgress);
  if (
    p.playerProgress.totalXp !== xpBefore ||
    Object.keys(p.playerProgress.achievements).length !== achBefore
  ) {
    await writePersisted(p);
  }
}

/**
 * After practice data was written — notify if daily goal just reached (once per local day).
 */
export async function maybeNotifyDailyGoalMet(p: PersistedData): Promise<void> {
  const dailyTarget = p.settings.goals?.dailyTargetSec;
  if (dailyTarget === null || dailyTarget === undefined || dailyTarget <= 0) return;

  const todayKey = dateKeyFromTimestamp(Date.now());
  const todaySec = p.dailySeconds[todayKey] ?? 0;
  if (todaySec < dailyTarget) return;

  await syncDailyGoalXpFromPersisted(p);

  if (!canNotify(p) || !(await notificationsGranted())) return;
  if (p.settings.lastNotifiedGoalMetDate === todayKey) return;

  const t = notifyT(p);
  try {
    await chrome.notifications.create(`jp-goal-met-${todayKey}`, {
      type: 'basic',
      iconUrl: notificationIconUrl(),
      title: t('notif.dailyGoalMetTitle', { app: APP_NAME }),
      message: t('notif.dailyGoalMetMessage', { duration: formatDuration(todaySec) }),
      priority: 0,
    });
  } catch {
    /* ignore */
  }

  const fresh = await readPersisted();
  fresh.settings.lastNotifiedGoalMetDate = todayKey;
  fresh.settings = ensureSettingsShape(fresh.settings);
  await writePersisted(fresh);
}

/**
 * Periodic check: evening nudge if goal not met; also goal-met if user crossed threshold without tick (edge cases).
 */
export async function runPeriodicGoalChecks(): Promise<void> {
  const p = await readPersisted();

  const dailyTarget = p.settings.goals?.dailyTargetSec;
  if (dailyTarget === null || dailyTarget === undefined || dailyTarget <= 0) return;

  const now = Date.now();
  const todayKey = dateKeyFromTimestamp(now);
  const todaySec = p.dailySeconds[todayKey] ?? 0;
  const hour = new Date(now).getHours();
  const nh = nudgeHour(p);

  if (todaySec >= dailyTarget) {
    processDailyGoalXpEvent(p, todayKey);
    await writePersisted(p);
    if (canNotify(p) && (await notificationsGranted()) && p.settings.lastNotifiedGoalMetDate !== todayKey) {
      await maybeNotifyDailyGoalMet(p);
    }
    return;
  }

  if (!canNotify(p) || !(await notificationsGranted())) return;

  if (p.settings.lastNotifiedGoalNudgeDate === todayKey) return;
  if (hour < nh) return;

  const remaining = Math.max(0, dailyTarget - todaySec);
  const t = notifyT(p);

  try {
    await chrome.notifications.create(`jp-goal-nudge-${todayKey}`, {
      type: 'basic',
      iconUrl: notificationIconUrl(),
      title: t('notif.dailyGoalNudgeTitle', { app: APP_NAME }),
      message: t('notif.dailyGoalNudgeMessage', { remaining: formatDuration(remaining) }),
      priority: 0,
    });
  } catch {
    /* ignore */
  }

  const fresh = await readPersisted();
  fresh.settings.lastNotifiedGoalNudgeDate = todayKey;
  fresh.settings = ensureSettingsShape(fresh.settings);
  await writePersisted(fresh);
}
