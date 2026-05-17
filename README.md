# JustPractice (Chrome extension)

Track **YouTube** practice watch time, keep a **local library** of saved videos, and tag difficulty with **JLPT** (N5–N1), **CEFR** (A1–C2), or your own **custom** ordered levels. One active framework in settings at a time; other tags stay in the library as **Legacy**. Set **daily goals** with optional reminders. **English**, **French**, **Japanese**, **Hebrew**, **Spanish**, or **German** UI (browser default optional). Everything stays in **`chrome.storage.local`** on this browser profile.

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

1. **Home / Subscriptions / search:** Hover a video **thumbnail**. A **JustPractice** strip appears at the bottom. Pick a **level** (or unrated, optional Legacy entries when mixing frameworks) and **save**.
2. **Right‑click:** On YouTube, right‑click a watch or Shorts link, the **video**, or the **page** → **JustPractice** → **Unrated** or levels for the active framework to save.
3. **Watch / Shorts:** Use the floating panel — **Save to library**, **Level**, **Count practice time**, and (when saved) the mini calendar. Practice seconds accrue while the player **plays**, the tab is **visible**, and (by default) **focused**.
4. Click the toolbar icon for the **popup**, or **Open full stats & settings** for the full dashboard (`chrome://extensions` → this extension → **Extension options**). Change **Level framework** (JLPT, CEFR, or **Custom** with your own list) and **Language** under dashboard **Settings**.

Persisted data lives under the storage key **`jpPractice`**.
