import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import { readPersisted, withStorageTransaction } from '../lib/storage';

export async function enrichLibraryItemFromOEmbed(
  videoId: string,
  mode: 'fill-unknown' | 'overwrite' = 'fill-unknown',
): Promise<void> {
  try {
    const p = await readPersisted();
    const item = p.library.find((x) => x.videoId === videoId);
    if (!item) return;

    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const r = await fetch(oembed);
    if (!r.ok) return;
    const j = (await r.json()) as { title?: string; author_name?: string };
    await withStorageTransaction(async ({ read, write }) => {
      const latest = await read();
      const row = latest.library.find((x) => x.videoId === videoId);
      // A removed/re-added entry is a different save. Never revive the old row
      // or replace fields edited while this request was in flight.
      if (!row || row.addedAt !== item.addedAt) return;
      let changed = false;
      const fillTitle = row.title === item.title && (
        mode === 'overwrite' ||
        row.title === 'Unknown title' ||
        !row.title.trim() ||
        isPlaceholderYoutubePageTitle(row.title)
      );
      const fillChannel = row.channel === item.channel && (
        mode === 'overwrite' ||
        row.channel === 'Unknown channel' ||
        !row.channel.trim()
      );
      if (j.title?.trim() && fillTitle) {
        row.title = j.title.trim();
        changed = true;
      }
      if (j.author_name?.trim() && fillChannel) {
        row.channel = j.author_name.trim();
        changed = true;
      }
      if (changed) await write(latest);
    });
  } catch {
    /* network / parse */
  }
}
