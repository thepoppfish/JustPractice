import { WELCOME_PAGE_PATH } from './welcomeConfig';

export function welcomePageUrl(): string {
  return chrome.runtime.getURL(WELCOME_PAGE_PATH);
}

export function openWelcomePage(): void {
  void chrome.tabs.create({ url: welcomePageUrl() });
}
