import type { AnswerBookmark, RichTextBlock } from './types';

type NotionRichText = { type: 'text'; text: { content: string; link?: { url: string } } };
export type NotionBlock = { object: 'block'; type: string; [key: string]: unknown };

const MAX_RICH_TEXT_LENGTH = 2000;
const MAX_RICH_TEXT_PER_BLOCK = 100;

/** Notion caps a single rich text object at 2000 chars, so split instead of truncating. */
const richText = (value: string, href?: string): NotionRichText[] => {
  const link = href ? { link: { url: href } } : {};
  const chunks: NotionRichText[] = [];
  for (let index = 0; index < value.length; index += MAX_RICH_TEXT_LENGTH) {
    if (chunks.length === MAX_RICH_TEXT_PER_BLOCK) break;
    chunks.push({ type: 'text', text: { content: value.slice(index, index + MAX_RICH_TEXT_LENGTH), ...link } });
  }
  return chunks;
};

const block = (item: RichTextBlock): NotionBlock => {
  const content = richText(item.text, item.href);
  if (item.type === 'heading') return { object: 'block', type: 'heading_2', heading_2: { rich_text: content } };
  if (item.type === 'list_item') return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: content } };
  if (item.type === 'quote') return { object: 'block', type: 'quote', quote: { rich_text: content } };
  if (item.type === 'code') return { object: 'block', type: 'code', code: { rich_text: content, language: item.language || 'plain text' } };
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: content } };
};

export const bookmarkToNotionBlocks = (bookmark: AnswerBookmark): NotionBlock[] => [
  { object: 'block', type: 'heading_2', heading_2: { rich_text: richText('问题') } },
  ...bookmark.snapshot.question.map(block),
  { object: 'block', type: 'heading_2', heading_2: { rich_text: richText('回答') } },
  ...bookmark.snapshot.answer.map(block),
  { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(`收藏时间：${new Date(bookmark.snapshot.capturedAt).toLocaleString()}`) } },
  { object: 'block', type: 'paragraph', paragraph: { rich_text: richText('来源链接', bookmark.snapshot.sourceUrl) } },
];

export const batchNotionBlocks = (blocks: NotionBlock[], maxBlocks = 100, maxBytes = 450_000): NotionBlock[][] => {
  const result: NotionBlock[][] = [];
  let batch: NotionBlock[] = [];
  let bytes = 0;
  for (const item of blocks) {
    const size = new TextEncoder().encode(JSON.stringify(item)).length;
    if (batch.length && (batch.length >= maxBlocks || bytes + size > maxBytes)) {
      result.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(item);
    bytes += size;
  }
  if (batch.length) result.push(batch);
  return result;
};

export const notionIdFromUrl = (value: string) => value.match(/([0-9a-f]{32})(?:\?|$)/i)?.[1] ?? null;

