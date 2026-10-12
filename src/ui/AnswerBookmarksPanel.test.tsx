// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerBookmarksPanel } from './AnswerBookmarksPanel';
import { ANSWER_BOOKMARKS_KEY } from '../storage';
import type { AnswerBookmark, AnswerBookmarksState } from '../types';

const bookmark = (id: string, conversationId: string, title: string, question: string): AnswerBookmark => ({
  id, site: 'chatgpt', conversationId, conversationTitle: title, locator: id,
  status: 'local', hidden: false,
  snapshot: {
    question: [{ type: 'paragraph', text: question }],
    answer: [{ type: 'paragraph', text: `${question} 的回答` }],
    questionText: question,
    answerText: `${question} 的回答`,
    capturedAt: Number(id.slice(-1)),
    sourceUrl: `https://chatgpt.com/c/${conversationId.split(':')[1]}`,
  },
});

const stored: AnswerBookmarksState = {
  bookmarks: [
    bookmark('answer-1', 'chatgpt:here', '当前对话', '当前对话的问题'),
    bookmark('answer-2', 'chatgpt:other', '另一段对话', '另一段对话的问题'),
  ],
  conversations: {},
};

describe('AnswerBookmarksPanel', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/c/here');
    document.title = '当前对话 - ChatGPT';
    document.body.innerHTML = '';
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined, sendMessage: vi.fn() },
      storage: {
        local: {
          get: (keys: string[], callback: (result: Record<string, unknown>) => void) => callback(
            keys.includes(ANSWER_BOOKMARKS_KEY) ? { [ANSWER_BOOKMARKS_KEY]: stored } : {},
          ),
          set: (_value: Record<string, unknown>, callback: () => void) => callback(),
        },
        onChanged: { addListener: () => undefined, removeListener: () => undefined },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows only the current conversation until the scope is switched to all', async () => {
    render(<AnswerBookmarksPanel site="chatgpt" />);
    await waitFor(() => expect(screen.getByText('当前对话的问题')).not.toBeNull());
    expect(screen.queryByText('另一段对话的问题')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '全部对话' }));
    expect(screen.getByText('另一段对话的问题')).not.toBeNull();
    expect(screen.getByText('当前对话的问题')).not.toBeNull();
  });

  it('filters the list by question text', async () => {
    render(<AnswerBookmarksPanel site="chatgpt" />);
    await waitFor(() => expect(screen.getByText('当前对话的问题')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '全部对话' }));
    fireEvent.change(screen.getByLabelText('搜索回答收藏'), { target: { value: '另一段' } });

    expect(screen.queryByText('当前对话的问题')).toBeNull();
    expect(screen.getByText('另一段对话的问题')).not.toBeNull();
  });

  it('says so when the message is no longer on the page', async () => {
    render(<AnswerBookmarksPanel site="chatgpt" />);
    await waitFor(() => expect(screen.getByText('当前对话的问题')).not.toBeNull());

    // Nothing is rendered in the document, so focus() cannot locate the answer.
    fireEvent.click(screen.getByRole('button', { name: /跳转/ }));

    expect(screen.getByText(/没有在当前页面找到这条回答/)).not.toBeNull();
  });

  it('opens the source conversation instead of jumping for a bookmark from elsewhere', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<AnswerBookmarksPanel site="chatgpt" />);
    await waitFor(() => expect(screen.getByText('当前对话的问题')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '全部对话' }));

    fireEvent.click(screen.getByRole('button', { name: /打开对话/ }));

    expect(open).toHaveBeenCalledWith('https://chatgpt.com/c/other', '_blank', 'noopener');
  });
});
