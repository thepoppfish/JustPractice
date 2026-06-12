# GitHub Pages — plan of action (one-shot build)

**Goal:** A single implementation pass that produces a public landing page for JustPractice at:

**https://thepoppfish.github.io/JustPractice/**

The page explains the product, links to source + license, shows how to install from a GitHub Release (no Chrome Web Store), and embeds the tutorial video. No build step required for the site itself — static HTML/CSS only.

---

## Success criteria

- [x] Landing page files in `docs/` (enable Pages in GitHub settings to go live)
- [x] Install instructions for sideloading (Developer mode + unpacked zip)
- [x] “Download” points to **GitHub Releases** (not a zip in git)
- [x] GPL-3.0-or-later and copyright **Daniel** on the page
- [x] Responsive layout in `site.css`
- [x] `README.md` links to the live site
- [x] Internal dev docs not linked from `index.html`

---

## GitHub settings (manual, after deploy)

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **`master`**, folder: **`/docs`**
4. Save → wait ~1–2 minutes for deploy

Optional later: custom domain in Pages settings.

---

## One-shot deliverables

Everything below is created or updated in **one commit**:

| # | File | Action |
|---|------|--------|
| 1 | `docs/index.html` | **Create** — full landing page |
| 2 | `docs/site.css` | **Create** — styles (keeps HTML readable) |
| 3 | `docs/assets/icon-128.png` | **Create** — copy from `public/icons/icon-128.png` |
| 4 | `docs/assets/screenshot-popup.png` | **Create** — placeholder or real screenshot |
| 5 | `docs/assets/screenshot-panel.png` | **Create** — placeholder or real screenshot |
| 6 | `docs/assets/screenshot-dashboard.png` | **Create** — placeholder or real screenshot |
| 7 | `README.md` | **Update** — add “Website” + “Install from release” sections |
| 8 | GitHub Release `v1.0.0` | **Manual** — attach `release/justpractice-1.0.0.zip` from `npm run package` |

**Do not add:** `dist/`, `release/*.zip`, or user data to git.

**Do not use Jekyll** for v1 — plain static files avoid gem/config friction. Add `docs/.nojekyll` (empty file) so GitHub does not try to process the folder with Jekyll.

---

## Page structure (`docs/index.html`)

Single scroll page with these sections in order:

### 1. Header / hero

- Logo: `docs/assets/icon-128.png` (48–64px display)
- **H1:** JustPractice
- **Tagline:** Track YouTube practice time. Build a local library. Tag videos with JLPT, CEFR, or custom levels.
- **Primary CTA button:** “Download latest release” → `https://github.com/thepoppfish/JustPractice/releases/latest`
- **Secondary link:** “View source on GitHub” → repo root
- Small badge row: `Chrome extension` · `GPL-3.0` · `Local-only data`

### 2. Features (3–4 cards)

| Card | Copy |
|------|------|
| Practice timer | Counts watch time while YouTube plays (visible, focused tab). Daily goals and streaks on the dashboard. |
| Video library | Save videos from YouTube with difficulty tags (JLPT N5–N1, CEFR A1–C2, or your own custom list). |
| Full dashboard | Stats, heatmaps, Today path, achievements, settings — open from the toolbar popup or extension options. |
| Private by default | All data stays in `chrome.storage.local` on your device. Export/import JSON backup anytime. |

### 3. Screenshots

Horizontal row or 2×2 grid on desktop; stack on mobile.

| Asset | Alt text |
|-------|----------|
| `screenshot-popup.png` | JustPractice toolbar popup |
| `screenshot-panel.png` | YouTube watch panel |
| `screenshot-dashboard.png` | Dashboard stats and library |

**v1 placeholder strategy:** If real screenshots are not ready at build time, use styled placeholder cards with labels (“Screenshot: popup”) and replace images in a follow-up commit without changing layout.

### 4. Tutorial video

- **Heading:** Watch how it works
- Thumbnail + play affordance (reuse pattern from welcome page): links to  
  `https://www.youtube.com/watch?v=bT_g9030hx0`
- Thumbnail URL: `https://i.ytimg.com/vi/bT_g9030hx0/hqdefault.jpg` (no extension embed — avoids iframe issues)
- One line: “Short walkthrough: saving videos and using the panel.”

### 5. Install (numbered steps)

Title: **Install in Chrome (developer mode)**

Chrome does not allow one-click install outside the Web Store. Be explicit:

1. **Download** the latest `justpractice-*.zip` from [Releases](https://github.com/thepoppfish/JustPractice/releases/latest).
2. **Extract** the zip to a folder (e.g. `justpractice-1.0.0/`). You should see `manifest.json` at the top level.
3. Open `chrome://extensions`.
4. Enable **Developer mode** (top right).
5. Click **Load unpacked** and select the **extracted folder** (not the zip file).

Note box: “Updates: download a new release zip and load the new folder (or replace files and click Reload on the extension card).”

Alternative collapsible: **Build from source** — `git clone` → `npm install` → `npm run build` → Load unpacked → `dist/`.

### 6. Quick usage (short bullets)

Mirror README usage (condensed):

- Toolbar popup for today’s progress; open dashboard for full stats.
- On YouTube watch: floating panel — save, level, practice timer, mini calendar.
- Right-click video links → JustPractice → level.
- Settings: level framework (JLPT / CEFR / Custom), UI language (EN, FR, JA, HE, ES, DE).

### 7. Privacy & license footer

- **Privacy:** No accounts, no server. Data key: `jpPractice` in Chrome local storage.
- **License:** [GNU GPL v3 or later](https://www.gnu.org/licenses/gpl-3.0.html) — Copyright © Daniel. Source must stay open if you redistribute changes.
- Links: GitHub repo · Releases · Report issue (GitHub Issues if enabled)

---

## Design spec (`docs/site.css`)

Match extension dark theme (from `src/dashboard/dashboard.css` / `src/welcome/welcome.css`):

```css
--bg: #0a0a0a;
--surface: #1a1a1e;
--border: rgba(255, 255, 255, 0.1);
--text: #f1f3f4;
--muted: #9aa0a6;
--accent: #ff6b26;
--accent-soft: rgba(255, 107, 38, 0.14);
--radius: 14px;
--max-width: 960px;
```

- Font: `system-ui, Segoe UI, Roboto, sans-serif`
- Hero: subtle orange radial gradient (like welcome page)
- Buttons: primary filled `#ff6b26`, dark text or white on orange; hover slightly brighter
- Cards: `--surface` background, 1px border, `--radius`
- Responsive: single column &lt; 640px; no JS required for v1
- `color-scheme: dark`
- Accessible: focus outlines on links/buttons, sufficient contrast on body text

**Paths:** All asset URLs must be **relative** to the Pages root, e.g. `assets/icon-128.png` (works at `/JustPractice/`).

---

## `docs/index.html` technical requirements

- Valid HTML5, `lang="en"`
- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- `<title>JustPractice — YouTube practice tracker</title>`
- Meta description for search/social (one sentence from tagline)
- Optional Open Graph tags (og:title, og:description, og:image → `assets/icon-128.png` absolute URL for social crawlers)
- Link: `<link rel="stylesheet" href="site.css">`
- Link: `<link rel="icon" href="assets/icon-128.png">`
- No external JS libraries for v1
- No analytics for v1 (add later if desired)

---

## README.md updates

Add after the opening paragraph:

```markdown
## Website

**https://thepoppfish.github.io/JustPractice/** — overview, install guide, tutorial video.

## Install (release zip)

1. Download the latest release from [GitHub Releases](https://github.com/thepoppfish/JustPractice/releases/latest).
2. Extract the zip, then load the folder in Chrome as an unpacked extension (see website for steps).
```

Keep existing “Build from source” / dev sections; avoid duplicating the full install walkthrough.

---

## Release workflow (paired with Pages)

Before or right after Pages goes live:

```bash
npm run build
npm run package
```

1. GitHub → **Releases** → **Draft a new release**
2. Tag: `v1.0.0` (match `manifest.config.ts` version)
3. Title: `JustPractice 1.0.0`
4. Attach: `release/justpractice-1.0.0.zip`
5. Release notes: bullet summary (practice timer, library, JLPT/CEFR/custom, 6 languages, local storage)
6. Publish

The site’s “Download” button uses `/releases/latest` so it always points at the newest zip without editing HTML each time.

---

## Screenshot capture checklist (before or during one-shot)

Capture from a built extension (`npm run build` → load unpacked `dist/`):

| File | What to show |
|------|----------------|
| `screenshot-popup.png` | Popup open with today’s ring / stats |
| `screenshot-panel.png` | YouTube watch page with JustPractice panel visible |
| `screenshot-dashboard.png` | Dashboard Library or Stats tab |

Recommended width: ~1280px or 900px; PNG; compress with squoosh or similar. If skipped, ship placeholders and ticket a fast follow-up.

---

## Implementation order (single session)

Execute in this order without stopping for partial deploy:

1. Create `docs/.nojekyll`
2. Create `docs/assets/` and copy `icon-128.png`
3. Capture or create three screenshot PNGs
4. Write `docs/site.css` (full styles)
5. Write `docs/index.html` (all sections above)
6. Open `docs/index.html` locally in browser — check layout, links, mobile width
7. Update `README.md`
8. Commit: `docs: add GitHub Pages landing site`
9. Push to `master`
10. Enable Pages in GitHub settings (`master` / `docs`)
11. Create GitHub Release with zip
12. Verify live URL + download link + install steps

---

## Verification checklist

- [ ] https://thepoppfish.github.io/JustPractice/ loads (200, not 404)
- [ ] CSS and images load (no broken paths — remember repo name prefix)
- [ ] Release download link resolves to a zip with `manifest.json` at root
- [ ] Tutorial YouTube link opens correct video
- [ ] Page readable on phone-width viewport
- [ ] GPL and privacy copy present
- [ ] `docs/PACKAGE-FILE-AUDIT.csv` not linked from public nav (dev-only)

---

## Out of scope for v1 (document only)

| Item | Reason |
|------|--------|
| Firefox / Edge store pages | Chrome-only extension today |
| Auto-update mechanism | Requires store or self-hosted update manifest |
| Committing release zip to repo | Use Releases |
| i18n on website | English-only landing; extension has 6 UI locales |
| Blog / changelog on Pages | Use GitHub Releases notes |
| `docs/PROJECT-SLIMDOWN-PLAN.md` on homepage | Internal |

---

## Optional v2 (after v1 is live)

- GitHub Action: on tag `v*`, run `npm run package` and attach zip to Release automatically
- Real favicon set (16/32) in `docs/assets/`
- Short GIF for hero instead of static screenshots
- “Star on GitHub” button with count (needs GitHub API or static badge)
- Issues link + contributing blurb for open-source contributors

---

## When ready to execute

Say **“build the GitHub Pages site”** (or similar) and implement everything in **One-shot deliverables** in a single pass per this plan.
