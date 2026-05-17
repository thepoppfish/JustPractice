import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'JustPractice',
  version: '1.0.0',
  description:
    'Track YouTube practice time and a local library. Tag videos with JLPT (N5–N1), CEFR (A1–C2), or custom levels, goals, reminders — stored locally in Chrome.',
  permissions: ['storage', 'contextMenus', 'alarms', 'notifications'],
  host_permissions: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'JustPractice',
  },
  options_ui: {
    page: 'src/dashboard/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
      js: ['src/content/youtube.ts'],
      run_at: 'document_idle',
    },
  ],
});
