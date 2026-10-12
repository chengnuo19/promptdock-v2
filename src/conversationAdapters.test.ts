// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { chatGptConversationAdapter, geminiConversationAdapter } from './conversationAdapters';

describe('conversation adapter', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/c/thread-1');
    document.title = '测试对话 - ChatGPT';
    document.body.innerHTML = `
      <article data-message-author-role="user"><p>问题 <a href="https://example.com">链接</a></p></article>
      <article data-message-author-role="assistant" data-message-id="answer-1"><h2>标题</h2><p>回答</p><pre><code class="language-ts">const x = 1</code></pre><div class="group"></div></article>`;
  });

  it('pairs an assistant answer with the preceding user question and stable locator', () => {
    const message = chatGptConversationAdapter.messages()[0];
    expect(chatGptConversationAdapter.locator(message)).toBe('answer-1');
    expect(chatGptConversationAdapter.snapshot(message)).toMatchObject({ questionText: '问题 链接', answerText: '标题\n回答\nconst x = 1' });
    expect(chatGptConversationAdapter.getConversation().id).toBe('chatgpt:thread-1');
  });

  it('gives each Gemini answer its own locator when the DOM has no id attribute', () => {
    document.body.innerHTML = `
      <model-response><p>答一</p></model-response>
      <model-response><p>答二</p></model-response>`;
    const [first, second] = geminiConversationAdapter.messages();
    const firstLocator = geminiConversationAdapter.locator(first);

    expect(firstLocator).not.toBe('');
    expect(firstLocator).not.toBe(geminiConversationAdapter.locator(second));
    expect(geminiConversationAdapter.find(firstLocator)).toBe(first);
  });
});
