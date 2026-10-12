import type { AnswerBookmark, AnswerBookmarksState, ConversationRecord } from '../types';

export const createAnswerBookmarksState = (): AnswerBookmarksState => ({ bookmarks: [], conversations: {} });

export const bookmarksForConversation = (state: AnswerBookmarksState, conversationId: string) => state.bookmarks
  .filter(bookmark => bookmark.conversationId === conversationId && !bookmark.hidden);

/** Every bookmark still on file, newest first, across all conversations. */
export const visibleBookmarks = (state: AnswerBookmarksState): AnswerBookmark[] => state.bookmarks
  .filter(bookmark => !bookmark.hidden)
  .slice()
  .sort((left, right) => right.snapshot.capturedAt - left.snapshot.capturedAt);

export const searchBookmarks = (
  bookmarks: readonly AnswerBookmark[],
  query: string,
): AnswerBookmark[] => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...bookmarks];
  return bookmarks.filter(bookmark => [
    bookmark.conversationTitle,
    bookmark.snapshot.questionText,
    bookmark.snapshot.answerText,
  ].some(field => field.toLocaleLowerCase().includes(normalized)));
};

export const saveBookmark = (
  state: AnswerBookmarksState,
  bookmark: AnswerBookmark,
  conversation: ConversationRecord,
): AnswerBookmarksState => ({
  conversations: { ...state.conversations, [conversation.id]: conversation },
  bookmarks: state.bookmarks.some(item => item.id === bookmark.id)
    ? state.bookmarks.map(item => item.id === bookmark.id ? { ...item, hidden: false } : item)
    : [...state.bookmarks, bookmark],
});

export const removeBookmark = (state: AnswerBookmarksState, id: string): AnswerBookmarksState => ({
  ...state,
  bookmarks: state.bookmarks.flatMap(bookmark => {
    if (bookmark.id !== id) return [bookmark];
    return bookmark.status === 'synced' ? [{ ...bookmark, hidden: true }] : [];
  }),
});

export const updateBookmark = (
  state: AnswerBookmarksState,
  id: string,
  changes: Partial<AnswerBookmark>,
): AnswerBookmarksState => ({
  ...state,
  bookmarks: state.bookmarks.map(bookmark => bookmark.id === id ? { ...bookmark, ...changes } : bookmark),
});

