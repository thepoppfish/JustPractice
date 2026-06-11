import { openWelcomePage, welcomePageUrl } from '../lib/welcomePage';

export function shouldOpenWelcomeOnInstall(reason: string): boolean {
  return reason === 'install';
}

export { welcomePageUrl };

export function attachBackgroundOnboardingListeners(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (shouldOpenWelcomeOnInstall(details.reason)) {
      openWelcomePage();
    }
  });
}
