# Demo data for screenshots

Use **`demo-screenshot-backup.json`** when you want polished dashboard/popup stats for marketing screenshots, then switch back to your real data.

## Before you start

1. **Export your real data** — Dashboard → Settings → **Export JSON**. Keep that file safe.
2. Regenerate demo data if needed (dates stay relative to “today”):

   ```bash
   node scripts/generate-demo-screenshot-backup.mjs
   ```

## Load demo data

1. Open the extension **dashboard** (full stats page).
2. Settings → **Restore from JSON…**
3. Choose `docs/demo-screenshot-backup.json` from this repo.
4. Confirm the replace prompt.

You should see:

- ~18 library videos (JLPT N5–N1 mix)
- Green/gold heatmap (most recent months practiced)
- ~30 min daily goal with strong recent days
- Long streak, decent XP / achievements
- Display name **Yuki** (fictional)

## Take screenshots

Capture popup, YouTube panel, and dashboard for `docs/assets/` on the GitHub Pages site.

## Restore your real data

1. Dashboard → **Restore from JSON…**
2. Select the export you saved in step 1.
3. Confirm.

Your `jpPractice` data is fully replaced on restore — there is no merge.

## Note

This file is **fiction for visuals only**. It is not shipped in the extension zip (`npm run package` only includes runtime `dist/` files).
