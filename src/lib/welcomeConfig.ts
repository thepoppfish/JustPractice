/** Welcome onboarding tutorial — https://www.youtube.com/watch?v=bT_g9030hx0 */
export const WELCOME_TUTORIAL_VIDEO_ID = 'bT_g9030hx0';

/** Quick-pick daily goal chips (minutes). */
export const WELCOME_GOAL_PRESET_MINUTES = [30, 60, 120] as const;

export const WELCOME_PAGE_PATH = 'src/welcome/index.html';

export function welcomeTutorialWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function welcomeTutorialThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
