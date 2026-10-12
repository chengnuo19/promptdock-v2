import { describe, expect, it } from 'vitest';
import { blocksToMarkdown, bookmarksToMarkdown } from './answerExport';
import type { AnswerBookmark, ConversationRecord } from '../types';

const bookmark = (overrides: Partial<AnswerBookmark> = {}): AnswerBookmark => ({
  id: 'answer-1',
  site: 'chatgpt',
  conversationId: 'chatgpt:a',
  conversationTitle: 'A',
  locator: 'm1',
  status: 'local',
  hidden: false,
  snapshot: {
    question: [{ type: 'paragraph', text: '怎么做灵敏度分析' }],
    answer: [{ type: 'paragraph', text: '先固定其他参数。' }],
    questionText: '怎么做灵敏度分析',
    answerText: '先固定其他参数。',
    capturedAt: Date.UTC(2026, 8, 4),
    sourceUrl: 'https://chatgpt.com/c/a',
  },
  ...overrides,
});

describe('answer bookmark export', () => {
  it('renders each block type and turns a linked block into a markdown link', () => {
    expect(blocksToMarkdown([
      { type: 'heading', text: '标题' },
      { type: 'paragraph', text: '正文' },
      { type: 'list_item', text: '要点' },
      { type: 'quote', text: '引用' },
      { type: 'code', text: 'const x = 1', language: 'ts' },
      { type: 'paragraph', text: '来源', href: 'https://example.com' },
    ])).toBe([
      '### 标题',
      '正文',
      '- 要点',
      '> 引用',
      '```ts\nconst x = 1\n```',
      '[来源](https://example.com)',
    ].join('\n\n'));
  });

  it('groups bookmarks under their conversation and keeps first-seen order', () => {
    const conversations: Record<string, ConversationRecord> = {
      'chatgpt:a': { id: 'chatgpt:a', site: 'chatgpt', title: '建模讨论', sourceUrl: 'https://chatgpt.com/c/a' },
    };
    const markdown = bookmarksToMarkdown([
      bookmark(),
      bookmark({ id: 'answer-2', conversationId: 'chatgpt:b', conversationTitle: '另一段对话' }),
      bookmark({ id: 'answer-3' }),
    ], conversations, new Date(Date.UTC(2026, 8, 4)));

    expect(markdown.indexOf('## 建模讨论')).toBeLessThan(markdown.indexOf('## 另一段对话'));
    expect(markdown).toContain('共 3 条');
    expect(markdown.match(/^## /gm)).toHaveLength(2);
    expect(markdown.match(/^### 问题$/gm)).toHaveLength(3);
    expect(markdown).toContain('[原文链接](https://chatgpt.com/c/a)');
  });

  it('falls back to the stored title and marks empty snapshots', () => {
    const markdown = bookmarksToMarkdown([bookmark({
      snapshot: { ...bookmark().snapshot, question: [], answer: [] },
    })]);

    expect(markdown).toContain('## A');
    expect(markdown).toContain('_未找到对应问题_');
    expect(markdown).toContain('_回答内容为空_');
  });
});
