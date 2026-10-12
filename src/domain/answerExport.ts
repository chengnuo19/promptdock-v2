import type { AnswerBookmark, AnswerBookmarksState, RichTextBlock } from '../types';

const blockToMarkdown = (block: RichTextBlock): string => {
  const text = block.href ? `[${block.text}](${block.href})` : block.text;
  if (block.type === 'heading') return `### ${text}`;
  if (block.type === 'list_item') return `- ${text}`;
  if (block.type === 'quote') return `> ${text}`;
  if (block.type === 'code') return `\`\`\`${block.language ?? ''}\n${block.text}\n\`\`\``;
  return text;
};

export const blocksToMarkdown = (blocks: readonly RichTextBlock[]): string => blocks
  .map(blockToMarkdown)
  .join('\n\n');

const bookmarkToMarkdown = (bookmark: AnswerBookmark): string => [
  '### 问题',
  blocksToMarkdown(bookmark.snapshot.question) || '_未找到对应问题_',
  '### 回答',
  blocksToMarkdown(bookmark.snapshot.answer) || '_回答内容为空_',
  `收藏于 ${new Date(bookmark.snapshot.capturedAt).toLocaleString()} · [原文链接](${bookmark.snapshot.sourceUrl})`,
].join('\n\n');

/** Groups by conversation so an export of several conversations stays readable. */
export const bookmarksToMarkdown = (
  bookmarks: readonly AnswerBookmark[],
  conversations: AnswerBookmarksState['conversations'] = {},
  exportedAt = new Date(),
): string => {
  const order: string[] = [];
  const grouped = new Map<string, AnswerBookmark[]>();
  bookmarks.forEach(bookmark => {
    if (!grouped.has(bookmark.conversationId)) {
      grouped.set(bookmark.conversationId, []);
      order.push(bookmark.conversationId);
    }
    grouped.get(bookmark.conversationId)!.push(bookmark);
  });

  const sections = order.map(conversationId => {
    const items = grouped.get(conversationId)!;
    const title = conversations[conversationId]?.title
      ?? items[0].conversationTitle
      ?? '未命名对话';
    return [`## ${title}`, ...items.map(bookmarkToMarkdown)].join('\n\n');
  });

  return [
    '# PromptDock 回答收藏',
    `导出时间：${exportedAt.toLocaleString()} · 共 ${bookmarks.length} 条`,
    ...sections,
  ].join('\n\n') + '\n';
};
