import { expect, it } from 'vitest';
import { emptyPersisted, type LibraryItem } from './storage';
import { libraryMetricsHtml, playbackForLibraryItem } from './libraryPresentation';
import { createTranslator } from '../i18n';
const item: LibraryItem = { videoId: 'abcdefghijk', title: '<title>', channel: 'Channel', addedAt: 1, difficulty: null, completedAt: null, durationSec: 600 };
it('resumes from bounded playback rather than repeat practice time', () => {
  const data = emptyPersisted();
  data.videoSeconds[item.videoId] = 1800;
  data.videoPlaybackPositionSec[item.videoId] = 123.9;
  expect(playbackForLibraryItem(item, data)).toMatchObject({ position: 123, resume: true, href: 'https://www.youtube.com/watch?v=abcdefghijk&t=123s' });
  const html = libraryMetricsHtml(item, data, createTranslator('en'));
  expect(html).toContain('30 min');
  expect(html).toContain('value="123"');
  expect(html).toContain('max="600"');
  expect(html).not.toContain('<title>');
});
it('offers Open at the end or after completion, and handles unknown lengths', () => {
  const data = emptyPersisted();
  data.videoPlaybackPositionSec[item.videoId] = 1000;
  expect(playbackForLibraryItem(item, data)).toMatchObject({ position: 600, resume: false });
  data.videoPlaybackPositionSec[item.videoId] = 123;
  expect(playbackForLibraryItem({ ...item, completedAt: 2 }, data).resume).toBe(false);
  const unknown = { ...item, durationSec: null };
  expect(playbackForLibraryItem(unknown, data).resume).toBe(true);
  expect(libraryMetricsHtml(unknown, data, createTranslator('en'))).not.toContain('<progress');
});
