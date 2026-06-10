/** Display name shown across the extension UI and notifications */
export const APP_NAME = 'JustPractice';

/** Packaged extension icon (toolbar, dashboard, popup). */
export function appIconUrl(size: 16 | 32 | 48 | 96 | 128 = 48): string {
  const path = `icons/icon-${size}.png`;
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}
