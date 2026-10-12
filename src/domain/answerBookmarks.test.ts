import { describe, expect, it } from 'vitest';
import { bookmarksForConversation, createAnswerBookmarksState, removeBookmark, saveBookmark, searchBookmarks, visibleBookmarks } from './answerBookmarks';
import type { AnswerBookmark, ConversationRecord } from '../types';

const conversation: ConversationRecord = { id: 'chatgpt:a', site: 'chatgpt', title: 'A', sourceUrl: 'https://chatgpt.com/c/a' };
const bookmark: AnswerBookmark = {
  id: 'answer-1', site: 'chatgpt', conversationId: conversation.id, conversationTitle: 'A', locator: 'm1',
  snapshot: { question: [], answer: [], questionText: 'Q', answerText: 'A', capturedAt: 1, sourceUrl: conversation.sourceUrl },
  status: 'local', hidden: false,
};

describe('answer bookmarks', () => {
  it('isolates conversations and removes local bookmarks', () => {
    const state = saveBookmark(createAnswerBookmarksState(), bookmark, conversation);
    expect(bookmarksForConversation(state, conversation.id)).toEqual([bookmark]);
    expect(bookmarksForConversation(state, 'chatgpt:b')).toEqual([]);
    expect(removeBookmark(state, bookmark.id).bookmarks).toEqual([]);
  });

  it('hides a synced bookmark instead of deleting its remote history', () => {
    const state = saveBookmark(createAnswerBookmarksState(), { ...bookmark, status: 'synced' }, conversation);
    const removed = removeBookmark(state, bookmark.id);
    expect(removed.bookmarks[0]).toMatchObject({ hidden: true, status: 'synced' });
  });

  it('lists every conversation newest first and leaves hidden ones out', () => {
    const other: ConversationRecord = { id: 'chatgpt:b', site: 'chatgpt', title: 'B', sourceUrl: 'https://chatgpt.com/c/b' };
    const newer: AnswerBookmark = {
      ...bookmark, id: 'answer-2', conversationId: other.id, conversationTitle: 'B',
      snapshot: { ...bookmark.snapshot, questionText: '第二个问题', capturedAt: 9 },
    };
    const hiddenOne: AnswerBookmark = { ...bookmark, id: 'answer-3', hidden: true };

    let state = saveBookmark(createAnswerBookmarksState(), bookmark, conversation);
    state = saveBookmark(state, newer, other);
    state = saveBookmark(state, hiddenOne, conversation);

    expect(visibleBookmarks(state).map(item => item.id)).toEqual(['answer-2', 'answer-1']);
  });

  it('searches conversation titles, questions and answers case-insensitively', () => {
    const other: AnswerBookmark = {
      ...bookmark, id: 'answer-2', conversationTitle: '数学建模',
      snapshot: { ...bookmark.snapshot, questionText: '灵敏度分析怎么做', answerText: 'ALPHA' },
    };

    expect(searchBookmarks([bookmark, other], '建模').map(item => item.id)).toEqual(['answer-2']);
    expect(searchBookmarks([bookmark, other], '灵敏度').map(item => item.id)).toEqual(['answer-2']);
    expect(searchBookmarks([bookmark, other], 'alpha').map(item => item.id)).toEqual(['answer-2']);
    expect(searchBookmarks([bookmark, other], '  ')).toHaveLength(2);
  });
});
