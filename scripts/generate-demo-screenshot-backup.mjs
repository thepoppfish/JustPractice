/**
 * Generate docs/demo-screenshot-backup.json — polished fake data for marketing screenshots.
 * Run: node scripts/generate-demo-screenshot-backup.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_VERSION = 16;
const DAILY_GOAL_SEC = 30 * 60;
const MIN_CREDIT_SEC = 60;

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

const now = new Date();
const todayKey = dateKey(now);
const [ty, tm] = todayKey.split('-').map(Number);
const monthlyTarget = DAILY_GOAL_SEC * daysInMonth(ty, tm);

const library = [
  {
    videoId: 'pSvH9zF1vTs',
    title: 'Learn Hiragana in 45 Minutes — Complete Course',
    channel: 'Japanese Ammo with Misa',
    difficulty: 'N5',
    durationSec: 2720,
    completedAt: Date.now() - 45 * 86400000,
  },
  {
    videoId: '9WWOz6JExKQ',
    title: 'Essential Japanese Grammar for Beginners',
    channel: 'JapanesePod101',
    difficulty: 'N5',
    durationSec: 1845,
    completedAt: Date.now() - 30 * 86400000,
  },
  {
    videoId: 'b3VKuAjyF6k',
    title: '1000 Most Common Japanese Words',
    channel: 'ToKini Andy',
    difficulty: 'N4',
    durationSec: 3600,
    completedAt: null,
  },
  {
    videoId: 'K6jrA0h0yP8',
    title: 'Japanese Listening Practice — Daily Conversation',
    channel: 'Nihongo no Mori',
    difficulty: 'N4',
    durationSec: 1240,
    completedAt: Date.now() - 12 * 86400000,
  },
  {
    videoId: 'L6d7PrCzqDI',
    title: 'Kanji Study Method That Actually Works',
    channel: 'Matt vs Japan',
    difficulty: 'N3',
    durationSec: 1580,
    completedAt: null,
  },
  {
    videoId: '0PaU0wqL6bY',
    title: 'Shadowing Practice — Natural Speed Japanese',
    channel: 'Comprehensible Japanese',
    difficulty: 'N3',
    durationSec: 900,
    completedAt: Date.now() - 8 * 86400000,
  },
  {
    videoId: '7fNbjDVwKuE',
    title: 'JLPT N3 Grammar — Particles Masterclass',
    channel: 'Miku Real Japanese',
    difficulty: 'N3',
    durationSec: 2100,
    completedAt: null,
  },
  {
    videoId: 'w2Yxd4RiG9k',
    title: 'Anime Japanese vs Real Japanese',
    channel: 'Japanese Ammo with Misa',
    difficulty: 'N2',
    durationSec: 1120,
    completedAt: null,
  },
  {
    videoId: '3Z9Lw5FqJ8s',
    title: 'News in Slow Japanese — Week 24',
    channel: 'NHK World Japan',
    difficulty: 'N2',
    durationSec: 780,
    completedAt: Date.now() - 20 * 86400000,
  },
  {
    videoId: 'hTWKbfoikeg',
    title: 'Japanese Pronunciation — Pitch Accent Basics',
    channel: 'Dogen',
    difficulty: 'N4',
    durationSec: 1420,
    completedAt: null,
  },
  {
    videoId: 'kffacxfA7G4',
    title: 'Immersion Setup for Busy Learners',
    channel: 'Matt vs Japan',
    difficulty: 'N3',
    durationSec: 1680,
    completedAt: Date.now() - 5 * 86400000,
  },
  {
    videoId: 'nW6jqP6e0c4',
    title: 'JLPT N2 Listening — Practice Test',
    channel: 'Nihongo no Mori',
    difficulty: 'N2',
    durationSec: 2400,
    completedAt: null,
  },
  {
    videoId: 'q8l9d0m2x1w',
    title: 'Daily Japanese Diary — Talking About Your Week',
    channel: 'YUYUの日本語Podcast',
    difficulty: 'N3',
    durationSec: 1320,
    completedAt: null,
  },
  {
    videoId: 'r7p8q9s0t1u',
    title: 'Counter Words Made Simple',
    channel: 'JapanesePod101',
    difficulty: 'N5',
    durationSec: 960,
    completedAt: Date.now() - 60 * 86400000,
  },
  {
    videoId: 'v2m3n4o5p6q',
    title: 'Reading Practice — Graded Stories N4',
    channel: 'Satori Reader',
    difficulty: 'N4',
    durationSec: 1100,
    completedAt: null,
  },
  {
    videoId: 'x1y2z3a4b5c',
    title: 'Keigo Explained for Everyday Situations',
    channel: 'Miku Real Japanese',
    difficulty: 'N2',
    durationSec: 1750,
    completedAt: null,
  },
  {
    videoId: 'd4e5f6g7h8i',
    title: 'Morning Routine Vlog — Comprehensible Input',
    channel: 'Comprehensible Japanese',
    difficulty: 'N4',
    durationSec: 840,
    completedAt: Date.now() - 3 * 86400000,
  },
  {
    videoId: 'j9k0l1m2n3o',
    title: 'JLPT N1 Vocabulary — Context Clues',
    channel: 'Nihongo no Mori',
    difficulty: 'N1',
    durationSec: 1980,
    completedAt: null,
  },
].map((v, i) => ({
  videoId: v.videoId,
  title: v.title,
  channel: v.channel,
  addedAt: Date.now() - (90 - i * 4) * 86400000,
  difficulty: v.difficulty,
  completedAt: v.completedAt,
  durationSec: v.durationSec,
}));

const installDate = addDays(now, -118);
const extensionInstalledDateKey = dateKey(installDate);

const dailySeconds = {};
const videoSeconds = {};
const videoDailySeconds = {};
const videoPlaybackPositionSec = {};

for (let i = 118; i >= 0; i--) {
  const d = addDays(now, -i);
  const key = dateKey(d);
  const dayOfWeek = d.getDay();
  const isToday = key === todayKey;

  let sec;
  if (isToday) {
    sec = 22 * 60;
  } else if (dayOfWeek === 0) {
    sec = 28 * 60 + 15;
  } else if (i % 17 === 0) {
    sec = 75 * 60;
  } else if (i % 11 === 0) {
    sec = 42 * 60;
  } else {
    sec = DAILY_GOAL_SEC + 8 * 60 + (i % 7) * 90;
  }

  dailySeconds[key] = sec;

  const vids = library.slice(0, 5 + (i % 6));
  let left = sec;
  vids.forEach((item, idx) => {
    const chunk =
      idx === vids.length - 1 ? left : Math.floor(sec / vids.length) + (idx % 3) * 60;
    left -= chunk;
    videoSeconds[item.videoId] = (videoSeconds[item.videoId] ?? 0) + chunk;
    if (!videoDailySeconds[item.videoId]) videoDailySeconds[item.videoId] = {};
    videoDailySeconds[item.videoId][key] = chunk;
    const pos = Math.min(item.durationSec ?? 600, Math.floor(chunk * 1.1));
    videoPlaybackPositionSec[item.videoId] = Math.max(
      videoPlaybackPositionSec[item.videoId] ?? 0,
      pos,
    );
  });
}

const totalPracticeSec = Object.values(dailySeconds).reduce((a, b) => a + b, 0);
const totalXp = Math.min(50000, Math.floor(totalPracticeSec / 60) + 3200);

const achievementUnlock = Date.now() - 40 * 86400000;
const achievements = {
  lib_1: achievementUnlock - 80 * 86400000,
  lib_5: achievementUnlock - 70 * 86400000,
  lib_10: achievementUnlock - 50 * 86400000,
  lib_25: achievementUnlock - 20 * 86400000,
  complete_1: achievementUnlock - 45 * 86400000,
  complete_5: achievementUnlock - 25 * 86400000,
  complete_10: achievementUnlock - 10 * 86400000,
  watch_1h: achievementUnlock - 75 * 86400000,
  watch_10h: achievementUnlock - 55 * 86400000,
  watch_50h: achievementUnlock - 15 * 86400000,
  streak_3: achievementUnlock - 60 * 86400000,
  streak_7: achievementUnlock - 35 * 86400000,
  streak_14: achievementUnlock - 5 * 86400000,
  level_5: achievementUnlock - 40 * 86400000,
  level_10: achievementUnlock - 18 * 86400000,
  first_practice: achievementUnlock - 85 * 86400000,
};

const completeXpAwarded = {};
for (const item of library) {
  if (item.completedAt) completeXpAwarded[item.videoId] = true;
}

const jpPractice = {
  schemaVersion: SCHEMA_VERSION,
  library,
  extensionInstalledDateKey,
  dailySeconds,
  videoSeconds,
  videoPlaybackPositionSec,
  videoDailySeconds,
  settings: {
    pauseWhenUnfocused: true,
    learningFocusHideRecommendations: true,
    yearHeatmapCalendar: true,
    calendarShowPracticeTime: true,
    goals: {
      dailyTargetSec: DAILY_GOAL_SEC,
      weeklyTargetSec: DAILY_GOAL_SEC * 7,
      monthlyTargetSec: monthlyTarget,
    },
    levelFramework: 'jlpt',
    customLevels: ['Beginner', 'Intermediate', 'Advanced'],
    uiLocale: 'en',
    goalNotificationsEnabled: false,
    goalNudgeHourLocal: null,
    lastNotifiedGoalMetDate: null,
    lastNotifiedGoalNudgeDate: null,
    watchPanelXpToastsEnabled: true,
    displayName: 'Yuki',
    customDailyMessages: [],
    dailyMotivationEnabled: true,
  },
  playerProgress: {
    totalXp,
    lifetimeXp: totalXp,
    prestigeLevel: 0,
    achievements,
    lastDailyGoalXpDateKey: dateKey(addDays(now, -1)),
    lastStreakXpDateKey: todayKey,
    completeXpAwarded,
    practiceXpCarrySeconds: 18,
  },
  todayPathPlan: null,
  roadmapCompletionSnapshot: null,
  roadmapBonusPick: null,
  onboardingCompletedAt: Date.now() - 100 * 86400000,
};

const out = { jpPractice };
const outPath = path.join(root, 'docs', 'demo-screenshot-backup.json');
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

const streakDays = (() => {
  let s = 0;
  for (let i = 0; i < 120; i++) {
    const k = dateKey(addDays(now, -i));
    if ((dailySeconds[k] ?? 0) >= MIN_CREDIT_SEC) s++;
    else if (i > 0) break;
  }
  return s;
})();

console.info(`[demo-backup] wrote ${path.relative(root, outPath)}`);
console.info(`  library: ${library.length} videos (${library.filter((v) => v.completedAt).length} completed)`);
console.info(`  practice days: ${Object.keys(dailySeconds).length}, total hours: ${(totalPracticeSec / 3600).toFixed(1)}`);
console.info(`  streak (approx): ${streakDays} days, totalXp: ${totalXp}`);
