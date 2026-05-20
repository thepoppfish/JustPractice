/** Strip trailing " - YouTube" / locale variants from `document.title`. */
export function stripYoutubeSuffixFromPageTitle(raw: string): string {
  return raw
    .replace(/\s*[-|–—｜・]\s*YouTube(?:\s+Music)?(?:\s+[\p{L}\p{N}]+)*\s*$/iu, '')
    .trim();
}

/** True when the scraped page title is not a real video name. */
export function isPlaceholderYoutubePageTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t === 'Unknown title') return true;
  return /^youtube$/i.test(t);
}
