export type PageId = 'typingTest' | 'typingSpeedGuide' | 'accuracyGuide' | 'wpmCalculator' | 'programmerTest' | 'progress';

export const PAGE_PATHS: Record<PageId, string> = {
  "typingTest": "/",
  "typingSpeedGuide": "/typing-speed-guide",
  "accuracyGuide": "/improve-typing-accuracy",
  "wpmCalculator": "/wpm-calculator",
  "programmerTest": "/typing-test-for-programmers",
  "progress": "/progress"
};

export function pagePath(page: PageId): string {
  return PAGE_PATHS[page];
}
