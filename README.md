# JustPractice (Chrome extension)

Track **YouTube** practice watch time, keep a **local library** of saved videos, and tag difficulty with **JLPT** (N5–N1), **CEFR** (A1–C2), or your own **custom** ordered levels. One active framework in settings at a time; other tags stay in the library as **Legacy**. Set **daily goals** and follow your progress. **English**, **French**, **Japanese**, **Hebrew**, **Spanish**, or **German** UI (browser default optional). Practice data stays in **`chrome.storage.local`** on this browser profile.

## Website

**https://thepoppfish.github.io/JustPractice/** — overview, install guide, tutorial video.

## Install (release zip)

1. Download the [ready-to-load extension ZIP](https://github.com/thepoppfish/JustPractice/releases/latest/download/justpractice.zip). Release notes and versioned ZIPs are on [GitHub Releases](https://github.com/thepoppfish/JustPractice/releases/latest). GitHub's automatic **Source code** archives require building first.
2. Extract the zip, then load the folder in Chrome as an unpacked extension ([full steps on the website](https://thepoppfish.github.io/JustPractice/#install)).

## Development

```bash
npm install
npm run dev
```

Edit files under `src/`. The dev server uses [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin/) for Chrome-extension builds.

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Install in Chrome (unpacked)

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this project’s **`dist`** folder.

## Usage

1. **Save a video:** Open a YouTube watch or Shorts page, then choose **Save to library** in the floating panel. Optionally choose a difficulty under **Level**.
2. **Save from a link:** On YouTube, right-click a watch or Shorts link, the video, or the page → **JustPractice** → **Unrated** or a level for the active framework.
3. **Practice automatically:** A saved video counts while it plays in a visible tab. There is no separate practice switch. Pause playback or switch to another tab to pause tracking. By default the YouTube page must also have focus: another window or DevTools taking focus pauses counting. Disable **Pause counting when YouTube loses focus** to allow a visible video in an inactive window to count. Hidden tabs never count, with either setting.
4. Click the toolbar icon for the **popup**, or **Open full stats & settings** for the full dashboard (`chrome://extensions` → this extension → **Extension options**). Change **Level framework** (JLPT, CEFR, or **Custom** with your own list) and **Language** under dashboard **Settings**.

Persisted data lives under the storage key **`jpPractice`**.

Practice progress is batched about every 30 seconds and flushed when the page loses focus or is hidden. The linked tutorial is an older recording of the saving flow; these instructions describe current counting behavior.

## Keyboard access

Use **Tab** to reach controls and arrow keys to choose onboarding languages and frameworks. In the popup, **Left/Right**, **Home**, and **End** switch tabs. In the year calendar, arrow keys move between days and weeks, **Home/End** jump to the first/last day, and **Enter** opens a month. Focus the watch panel’s move handle and use arrow keys to reposition it; hold **Shift** for larger steps. Hebrew uses a right-to-left layout while video titles and numeric progress retain their own reading direction. The setup greeting stays still when reduced motion is enabled.

## Backups

Use **Dashboard → Settings → Your data → Export JSON** before replacing a profile or uninstalling. Restore accepts recognized JustPractice exports up to 8 MB, checks their data and version, and previews the video count and practice minutes before confirmation. A recovery copy in browser session storage protects the previous data if a replacement fails or the service worker restarts during restore.

## Release checks

```bash
npm ci
npm run build
npm test
npm run package
```

The ZIP in `release/` contains only extension runtime files, with `manifest.json` at its root. The release workflow runs these checks and attaches both a versioned ZIP and `justpractice.zip` for the stable download link. Publish by pushing a version tag matching `manifest.config.ts`, or running the **Release extension** workflow on the intended commit. Never use a source archive as the unpacked extension.
