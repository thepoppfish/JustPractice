import { describe, expect, it } from 'vitest';
import { isPlaceholderYoutubePageTitle, stripYoutubeSuffixFromPageTitle } from './youtubePageTitle';

describe('stripYoutubeSuffixFromPageTitle', () => {
  it('removes ASCII hyphen YouTube suffix', () => {
    expect(stripYoutubeSuffixFromPageTitle('My Lesson - YouTube')).toBe('My Lesson');
  });

  it('removes fullwidth dash suffix used on some locales', () => {
    expect(stripYoutubeSuffixFromPageTitle('さきっちゃん - YouTube')).toBe('さきっちゃん');
  });

  it('leaves bare YouTube unchanged', () => {
    expect(stripYoutubeSuffixFromPageTitle('YouTube')).toBe('YouTube');
  });
});

describe('isPlaceholderYoutubePageTitle', () => {
  it('flags bare YouTube and unknown', () => {
    expect(isPlaceholderYoutubePageTitle('YouTube')).toBe(true);
    expect(isPlaceholderYoutubePageTitle('youtube')).toBe(true);
    expect(isPlaceholderYoutubePageTitle('Unknown title')).toBe(true);
    expect(isPlaceholderYoutubePageTitle('')).toBe(true);
  });

  it('accepts real titles', () => {
    expect(isPlaceholderYoutubePageTitle('さきっちゃん')).toBe(false);
    expect(isPlaceholderYoutubePageTitle('Grammar N3')).toBe(false);
  });
});
