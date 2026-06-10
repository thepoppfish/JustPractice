import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'JustPractice',
  version: '1.0.0',
  description:
    'Track YouTube practice time and a local library. Tag videos with JLPT (N5–N1), CEFR (A1–C2), or custom levels, goals, reminders — stored locally in Chrome.',
  permissions: ['storage', 'contextMenus', 'alarms', 'scripting'],
  host_permissions: [
    'https://www.youtube.com/*',
    'https://youtube.com/*',
    'https://m.youtube.com/*',
  ],
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'JustPractice',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
    },
  },
  options_ui: {
    page: 'src/dashboard/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  // YouTube: dist-only content_scripts via scripts/patch-crx-build.mjs (see vite-plugin-youtube-bundle.ts).
});
