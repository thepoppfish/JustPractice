import { isPlaceholderYoutubePageTitle } from '../lib/youtubePageTitle';
import { readPersisted, writePersisted } from '../lib/storage';

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
    let changed = false;
    const fillTitle =
      mode === 'overwrite' ||
      item.title === 'Unknown title' ||
      !item.title.trim() ||
      isPlaceholderYoutubePageTitle(item.title);
    const fillChannel =
      mode === 'overwrite' ||
      item.channel === 'Unknown channel' ||
      !item.channel.trim();
    if (j.title?.trim() && fillTitle) {
      item.title = j.title.trim();
      changed = true;
    }
    if (j.author_name?.trim() && fillChannel) {
      item.channel = j.author_name.trim();
      changed = true;
    }
    if (changed) await writePersisted(p);
  } catch {
    /* network / parse */
  }
}
