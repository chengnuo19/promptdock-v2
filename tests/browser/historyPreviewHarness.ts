import { installHistoryPreview } from '../../src/historyPreview';
import { chatGptSite } from '../../src/sites';
import '../../src/historyPreviewHarness.css';

const promptTexts = [
  '我现在是自动化专业大二学生，我想要在读书期间建立清晰的发展方向。',
  '如果我的目标是这个，我该怎么安排我的本科阶段？',
  '@Notion 能不能在 Notion 里给我一个规划？',
  '你觉得这个布局还有什么值得优化的吗',
  ...Array.from({ length: 28 }, (_, index) => `第 ${index + 5} 条长对话提问：用于验证展开面板中的滚轮和触控板滚动不会被页面抢走，并且这条提问本身足够长，可以检查面板条目在两行截断与悬停展开之间的切换是否正确。`),
];

const previews: Record<string, { mapping: Record<string, unknown> }> = {
  'yangtze-tail': {
    mapping: Object.fromEntries(promptTexts.map((prompt, index) => [`user-${index}`, {
      message: { create_time: index, author: { role: 'user' }, content: { parts: [prompt] } },
    }])),
  },
  'second-thread': {
    mapping: {
      user: { message: { author: { role: 'user' }, content: { parts: ['这里是另一条对话的提问。'] } } },
    },
  },
};

// The panel links entries to rendered messages, so the harness needs a real
// scrollable conversation rather than a single placeholder.
const thread = document.getElementById('thread')!;
promptTexts.forEach((prompt, index) => {
  // Leave the first two unrendered to exercise the "not loaded yet" state.
  if (index < 2) return;
  const question = document.createElement('article');
  question.dataset.messageAuthorRole = 'user';
  question.textContent = prompt;
  const answer = document.createElement('article');
  answer.dataset.messageAuthorRole = 'assistant';
  answer.textContent = `这是第 ${index + 1} 条回答的占位内容。`;
  thread.append(question, answer);
});

window.history.replaceState({}, '', '/g/g-example/c/yangtze-tail');

installHistoryPreview(chatGptSite, document, {
  delayMs: 180,
  fetcher: async input => ({
    ok: true,
    json: async () => previews[input.split('/').at(-1) ?? ''] ?? {},
  }),
});
