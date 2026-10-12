import type { SiteDefinition } from '../types';
import { queryEditable } from './dom';

export const getChatGptConversationId = (href: string, origin = window.location.origin): string | null => {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    return url.pathname.match(/\/c\/([^/]+)\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
};

export const chatGptSite: SiteDefinition = {
  name: 'chatgpt',
  hostnames: ['chatgpt.com', 'chat.openai.com'],
  composer: {
    find: () => queryEditable('#prompt-textarea'),
    anchorSelector: 'form',
    fileInputSelectors: [
      'form input[type="file"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
    ],
  },
  conversation: {
    messageSelector: '[data-message-author-role]',
    assistantSelector: '[data-message-author-role="assistant"]',
    userSelector: '[data-message-author-role="user"]',
    actionBarSelectors: ['[data-testid*="conversation-turn"] [class*="actions"]', '[class*="group"]'],
  },
  history: {
    conversationId: getChatGptConversationId,
    conversationPath: id => `/backend-api/conversation/${encodeURIComponent(id)}`,
  },
};
