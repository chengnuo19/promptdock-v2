import { createRoot, type Root } from 'react-dom/client';
import { getAdapter } from './adapters';
import { installHistoryPreview } from './historyPreview';
import { getSite } from './sites';
import { getConversationAdapter } from './conversationAdapters';
import { saveBookmark } from './domain/answerBookmarks';
import { ensureExtensionHost, removeExtensionHost } from './contentHost';
import { PromptDockApp } from './PromptDockApp';
import { loadAnswerBookmarks, saveAnswerBookmarks } from './storage';
import cssText from './index.css?inline';

const ANSWER_STAR_DEBOUNCE_MS = 200;

let root: Root | null = null;
let activeComposer: HTMLElement | null = null;
let frame = 0;
let bookmarkTimer = 0;
let bookmarkRunning = false;
let bookmarkQueued = false;
let removeHistoryPreview: (() => void) | null = null;

const unmount = () => {
  root?.unmount();
  root = null;
  activeComposer = null;
  removeExtensionHost();
};

const sync = () => {
  const adapter = getAdapter();
  const composer = adapter?.findComposer() ?? null;
  if (!adapter || !composer) {
    if (root) unmount();
    return;
  }
  if (root && activeComposer === composer && document.getElementById('promptdock-extension-host')) return;
  if (root) unmount();

  const extensionHost = ensureExtensionHost();
  const style = document.createElement('style');
  style.textContent = cssText;
  extensionHost.shadowRoot.prepend(style);
  root = createRoot(extensionHost.mount);
  activeComposer = composer;
  root.render(<PromptDockApp adapter={adapter} composer={composer} />);
};

const scheduleSync = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(sync);
};

const syncAnswerStars = async () => {
  const adapter = getAdapter();
  if (!adapter) return;
  const conversationAdapter = getConversationAdapter(adapter.name);
  const conversation = conversationAdapter.getConversation();
  const state = await loadAnswerBookmarks();
  conversationAdapter.messages().forEach(message => {
    const locator = conversationAdapter.locator(message);
    const id = `${conversation.id}:${locator}`;
    const actionBar = conversationAdapter.actionBar(message);
    if (!actionBar || actionBar.querySelector(`[data-promptdock-answer-star="${CSS.escape(id)}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.promptdockAnswerStar = id;
    button.textContent = '☆';
    button.title = state.bookmarks.some(bookmark => bookmark.id === id && !bookmark.hidden) ? '已收藏此回答' : '收藏回答';
    button.setAttribute('aria-label', button.title);
    button.style.cssText = 'border:0;background:transparent;cursor:pointer;font:inherit;font-size:18px;line-height:1;padding:4px;color:inherit;';
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      const snapshot = conversationAdapter.snapshot(message);
      if (!snapshot) return;
      void loadAnswerBookmarks().then(current => {
        const bookmark = { id, site: adapter.name, conversationId: conversation.id, conversationTitle: conversation.title, locator, snapshot, status: 'local' as const, hidden: false };
        return saveAnswerBookmarks(saveBookmark(current, bookmark, conversation));
      }).then(() => {
        button.textContent = '★'; button.title = '已收藏此回答'; button.setAttribute('aria-label', button.title);
      });
    });
    actionBar.appendChild(button);
  });
};

/**
 * ChatGPT mutates the DOM on every streamed token, so debounce the scan and never
 * let two passes overlap: each one reads chrome.storage and walks every message.
 */
const scheduleAnswerStars = () => {
  if (bookmarkRunning) {
    bookmarkQueued = true;
    return;
  }
  window.clearTimeout(bookmarkTimer);
  bookmarkTimer = window.setTimeout(() => {
    bookmarkRunning = true;
    void syncAnswerStars().finally(() => {
      bookmarkRunning = false;
      if (bookmarkQueued) {
        bookmarkQueued = false;
        scheduleAnswerStars();
      }
    });
  }, ANSWER_STAR_DEBOUNCE_MS);
};

const syncHistoryPreview = () => {
  const site = getSite();
  if (site && !removeHistoryPreview) removeHistoryPreview = installHistoryPreview(site);
  if (!site && removeHistoryPreview) {
    removeHistoryPreview();
    removeHistoryPreview = null;
  }
};

new MutationObserver(() => { scheduleSync(); scheduleAnswerStars(); syncHistoryPreview(); }).observe(document.body, { childList: true, subtree: true });
window.addEventListener('pageshow', () => { scheduleSync(); scheduleAnswerStars(); syncHistoryPreview(); });
scheduleSync();
scheduleAnswerStars();
syncHistoryPreview();
