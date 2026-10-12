/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PromptDockApp } from './PromptDockApp';
import { getConversationAdapter } from './conversationAdapters';
import { ANSWER_BOOKMARKS_KEY } from './storage';
import type { AnswerBookmark, InsertMode, SiteAdapter } from './types';
import './index.css';
import './browserHarness.css';

// The harness runs outside an extension, so storage-backed panels would all be
// empty. Stand in for chrome.storage.local with an in-memory store.
const installChromeStub = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return;
  const here = getConversationAdapter('chatgpt').getConversation();
  const answer = (id: string, conversationId: string, title: string, question: string): AnswerBookmark => ({
    id, site: 'chatgpt', conversationId, conversationTitle: title, locator: id, status: 'local', hidden: false,
    snapshot: {
      question: [{ type: 'paragraph', text: question }],
      answer: [{ type: 'paragraph', text: `关于「${question}」，可以先拆成目标、约束和交付物三部分来看。` }],
      questionText: question,
      answerText: `关于「${question}」，可以先拆成目标、约束和交付物三部分来看。`,
      capturedAt: Date.now() - Number(id.slice(-1)) * 86_400_000,
      sourceUrl: conversationId === here.id ? location.href : 'https://chatgpt.com/c/earlier-thread',
    },
  });

  const values: Record<string, unknown> = {
    [ANSWER_BOOKMARKS_KEY]: {
      bookmarks: [
        answer('harness-1', here.id, here.title, '请帮我整理一个项目计划'),
        answer('harness-2', 'chatgpt:earlier-thread', '上周的建模讨论', '灵敏度分析应该怎么设计'),
      ],
      conversations: {},
    },
  };

  Object.assign(globalThis, {
    chrome: {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: (keys: string[], callback: (result: Record<string, unknown>) => void) => callback(
            Object.fromEntries(keys.filter(key => key in values).map(key => [key, values[key]])),
          ),
          set: (next: Record<string, unknown>, callback: () => void) => {
            Object.assign(values, next);
            callback();
          },
        },
        onChanged: { addListener: () => undefined, removeListener: () => undefined },
      },
    },
  });
};

installChromeStub();

const Harness = () => {
  const [composer, setComposer] = useState<HTMLTextAreaElement | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('harness-dark', dark);
  }, [dark]);

  const adapter: SiteAdapter = {
    name: 'chatgpt',
    findComposer: () => composer,
    findAnchor: composer => composer.closest('form') as HTMLElement || composer,
    readText: composer => (composer as HTMLTextAreaElement).value,
    readSelection: composer => {
      const input = composer as HTMLTextAreaElement;
      const start = input.selectionStart ?? input.value.length;
      return { text: input.value, range: { start, end: input.selectionEnd ?? start }, caretRect: input.getBoundingClientRect() };
    },
    replaceRange: (text, range, composer) => {
      const input = composer as HTMLTextAreaElement;
      input.value = `${input.value.slice(0, range.start)}${text}${input.value.slice(range.end)}`;
      input.selectionStart = input.selectionEnd = range.start + text.length;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true };
    },
    focusComposer: composer => composer.focus(),
    writeText: (text: string, mode: InsertMode, composer: HTMLElement) => {
      const input = composer as HTMLTextAreaElement;
      input.value = mode === 'append' && input.value.trim() ? `${input.value}\n\n${text}` : text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true };
    },
    attachFiles: async () => ({ ok: true, status: 'attempted' }),
  };

  return (
    <main className="harness-page">
      <header className="harness-header">
        <strong>AI 对话页面模拟</strong>
        <button type="button" onClick={() => setDark(value => !value)}>{dark ? '切换浅色' : '切换深色'}</button>
      </header>
      <section className="harness-chat" aria-label="模拟对话">
        <article><span>你</span><p>请帮我整理一个项目计划。</p></article>
        <article className="assistant"><span>AI</span><p>可以。先告诉我项目目标与限制条件。</p></article>
      </section>
      <form className="harness-composer" onSubmit={event => event.preventDefault()}>
        <textarea ref={setComposer} id="prompt-textarea" aria-label="模拟输入框" placeholder="给 AI 发送消息" />
        <button type="submit">发送</button>
      </form>
      {composer && <PromptDockApp adapter={adapter} composer={composer} />}
    </main>
  );
};

declare global {
  interface Window {
    __promptDockHarnessRoot?: ReturnType<typeof createRoot>;
  }
}

const rootElement = document.getElementById('root')!;
window.__promptDockHarnessRoot ??= createRoot(rootElement);
window.__promptDockHarnessRoot.render(<Harness />);
