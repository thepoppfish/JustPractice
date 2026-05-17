/** Public thumbnail URL for a YouTube video id (no API key). */
export function thumbnailUrlForVideoId(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}
