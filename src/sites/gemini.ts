import type { SiteDefinition } from '../types';
import { findVisibleEditable } from './dom';

const USER_SELECTOR = 'user-query, .user-query, [data-user-query]';

export const geminiSite: SiteDefinition = {
  name: 'gemini',
  hostnames: ['gemini.google.com'],
  composer: {
    find: () => findVisibleEditable([
      '.input-area-container .ql-editor',
      'rich-textarea .ql-editor',
      '.input-area .ql-editor',
      '[contenteditable="true"][role="textbox"]',
      'textarea',
    ]),
    anchorSelector: '.input-area-container, .input-area, form',
    fileInputSelectors: [
      '.input-area-container input[type="file"]',
      '.input-area input[type="file"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
    ],
  },
  conversation: {
    messageSelector: 'model-response, .model-response-text, [data-response-id]',
    assistantSelector: 'model-response, .model-response-text, [data-response-id]',
    userSelector: USER_SELECTOR,
    actionBarSelectors: ['.response-actions', '.action-buttons', '[class*="actions"]'],
  },
  history: {
    // Gemini exposes no same-origin conversation endpoint, so the DOM is the only source.
    conversationId: () => null,
  },
};
