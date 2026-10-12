import { describe, expect, it } from 'vitest';
import { batchNotionBlocks, bookmarkToNotionBlocks, notionIdFromUrl } from './notion';
import type { AnswerBookmark } from './types';

describe('Notion block conversion helpers', () => {
  it('batches no more than 100 blocks and recognizes a Notion id', () => {
    const blocks = Array.from({ length: 205 }, () => ({ object: 'block' as const, type: 'paragraph', paragraph: { rich_text: [] } }));
    expect(batchNotionBlocks(blocks).map(batch => batch.length)).toEqual([100, 100, 5]);
    expect(notionIdFromUrl('https://www.notion.so/name-0123456789abcdef0123456789abcdef')).toBe('0123456789abcdef0123456789abcdef');
  });

  it('splits an over-long paragraph across rich text objects instead of truncating', () => {
    const long = 'x'.repeat(5000);
    const bookmark = {
      id: 'a', site: 'chatgpt', conversationId: 'c', conversationTitle: 't', locator: 'l',
      status: 'local', hidden: false,
      snapshot: {
        question: [], answer: [{ type: 'paragraph' as const, text: long }],
        questionText: '', answerText: long, capturedAt: 0, sourceUrl: 'https://example.com',
      },
    } satisfies AnswerBookmark;

    const paragraph = bookmarkToNotionBlocks(bookmark)[2] as unknown as { paragraph: { rich_text: { text: { content: string } }[] } };
    expect(paragraph.paragraph.rich_text).toHaveLength(3);
    expect(paragraph.paragraph.rich_text.map(item => item.text.content).join('')).toBe(long);
  });
});
