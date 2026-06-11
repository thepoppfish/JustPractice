/** Paste your YouTube video id here when the tutorial is ready (e.g. `dQw4w9WgXcQ`). */
export const WELCOME_TUTORIAL_VIDEO_ID = '';

/** Quick-pick daily goal chips (minutes). */
export const WELCOME_GOAL_PRESET_MINUTES = [30, 60, 120] as const;

export const WELCOME_PAGE_PATH = 'src/welcome/index.html';

export function welcomeTutorialEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}
