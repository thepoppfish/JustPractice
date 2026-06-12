import { describe, expect, it } from 'vitest';
import {
  welcomeTutorialThumbnailUrl,
  welcomeTutorialWatchUrl,
} from './welcomeConfig';

describe('welcomeTutorialWatchUrl', () => {
  it('builds a standard watch link', () => {
    expect(welcomeTutorialWatchUrl('bT_g9030hx0')).toBe(
      'https://www.youtube.com/watch?v=bT_g9030hx0',
    );
  });
});

describe('welcomeTutorialThumbnailUrl', () => {
  it('builds a YouTube thumbnail URL', () => {
    expect(welcomeTutorialThumbnailUrl('bT_g9030hx0')).toBe(
      'https://i.ytimg.com/vi/bT_g9030hx0/hqdefault.jpg',
    );
  });
});
