import { APP_NAME } from './branding';
import { createTranslator, resolveLocale } from '../i18n';
import { ensureSettingsShape, type PersistedData } from './storage';
import { achievementById } from './achievements';
import { notificationIconUrl } from './goalNotifications';

function notifyT(p: PersistedData): ReturnType<typeof createTranslator> {
  const s = ensureSettingsShape(p.settings);
  return createTranslator(resolveLocale(s.uiLocale));
}

function canNotifyXp(p: PersistedData): boolean {
  const s = ensureSettingsShape(p.settings);
  return s.xpNotificationsEnabled !== false;
}

async function notificationsGranted(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['notifications'] });
  } catch {
    return false;
  }
}

export async function maybeNotifyLevelUp(p: PersistedData, newLevel: number): Promise<void> {
  if (!canNotifyXp(p) || !(await notificationsGranted())) return;
  const t = notifyT(p);
  try {
    await chrome.notifications.create(`jp-level-up-${newLevel}-${Date.now()}`, {
      type: 'basic',
      iconUrl: notificationIconUrl(),
      title: t('notif.rankUpTitle', { app: APP_NAME }),
      message: t('notif.rankUpMessage', { level: String(newLevel) }),
      priority: 0,
    });
  } catch {
    /* ignore */
  }
}

export async function maybeNotifyAchievements(p: PersistedData, ids: string[]): Promise<void> {
  if (ids.length === 0 || !canNotifyXp(p) || !(await notificationsGranted())) return;
  const t = notifyT(p);
  for (const id of ids) {
    if (!achievementById(id)) continue;
    try {
      await chrome.notifications.create(`jp-ach-${id}-${Date.now()}`, {
        type: 'basic',
        iconUrl: notificationIconUrl(),
        title: t('notif.achievementTitle', { app: APP_NAME }),
        message: t(`achievement.${id}.title`),
        priority: 0,
      });
    } catch {
      /* ignore */
    }
  }
}

export async function maybeNotifyPrestigeUp(p: PersistedData, prestigeLevel: number): Promise<void> {
  if (!canNotifyXp(p) || !(await notificationsGranted())) return;
  const t = notifyT(p);
  try {
    await chrome.notifications.create(`jp-prestige-${prestigeLevel}-${Date.now()}`, {
      type: 'basic',
      iconUrl: notificationIconUrl(),
      title: t('notif.prestigeUpTitle', { app: APP_NAME }),
      message: t('notif.prestigeUpMessage', { level: String(prestigeLevel) }),
      priority: 0,
    });
  } catch {
    /* ignore */
  }
}

export async function maybeNotifyXpEvents(
  p: PersistedData,
  result: { levelUp: boolean; newLevel: number; newAchievements: string[] },
): Promise<void> {
  if (result.levelUp) await maybeNotifyLevelUp(p, result.newLevel);
  await maybeNotifyAchievements(p, result.newAchievements);
}
