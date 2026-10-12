// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentPromptIndex,
  installHistoryPreview,
  locateRenderedPrompts,
  parseChatGptHistoryPreview,
} from './historyPreview';
import { chatGptSite, geminiSite, getChatGptConversationId, getSite } from './sites';

const HOST_ID = 'promptdock-history-preview';

const shadow = () => document.getElementById(HOST_ID)!.shadowRoot!;
const rail = () => shadow().querySelector('.rail') as HTMLButtonElement;
const entries = () => Array.from(shadow().querySelectorAll('.prompt')) as HTMLButtonElement[];

const stubRect = (element: HTMLElement, top: number) => {
  element.getBoundingClientRect = () => ({
    x: 0, y: top, left: 0, top, right: 100, bottom: top + 20, width: 100, height: 20,
    toJSON: () => ({}),
  });
};

describe('history previews', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/c/current');
  });

  afterEach(() => vi.useRealTimers());

  it('recognizes only same-origin ChatGPT conversation links', () => {
    expect(getChatGptConversationId('/c/thread-1')).toBe('thread-1');
    expect(getChatGptConversationId('/g/g-example/c/thread-2')).toBe('thread-2');
    expect(getChatGptConversationId('/share/thread-1')).toBeNull();
    expect(getChatGptConversationId('https://example.com/c/thread-1')).toBeNull();
  });

  it('picks a site definition per supported host and none elsewhere', () => {
    expect(getSite('chatgpt.com')).toBe(chatGptSite);
    expect(getSite('chat.openai.com')).toBe(chatGptSite);
    expect(getSite('gemini.google.com')).toBe(geminiSite);
    expect(getSite('example.com')).toBeNull();
  });

  it('keeps user prompts in chronological order and excludes assistant responses', () => {
    expect(parseChatGptHistoryPreview({
      mapping: {
        laterUser: { message: { create_time: 2, author: { role: 'user' }, content: { parts: ['第二个问题'] } } },
        assistant: { message: { create_time: 1.5, author: { role: 'assistant' }, content: { parts: ['回答'] } } },
        firstUser: { message: { create_time: 1, author: { role: 'user' }, content: { parts: ['第一个问题'] } } },
      },
    })).toEqual({ prompts: ['第一个问题', '第二个问题'] });
  });

  it('drops the oldest questions rather than the newest when over the cap', () => {
    const mapping = Object.fromEntries(Array.from({ length: 90 }, (_, index) => [
      `user-${index}`,
      { message: { create_time: index, author: { role: 'user' }, content: { parts: [`第 ${index} 问`] } } },
    ]));

    const prompts = parseChatGptHistoryPreview({ mapping })!.prompts;
    expect(prompts).toHaveLength(80);
    expect(prompts[0]).toBe('第 10 问');
    expect(prompts.at(-1)).toBe('第 89 问');
  });
});

describe('linking preview entries to rendered messages', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const messages = (...texts: string[]) => texts.map(text => {
    const element = document.createElement('article');
    element.textContent = text;
    document.body.appendChild(element);
    return element;
  });

  it('matches by text and consumes duplicates in order', () => {
    const [first, second, third] = messages('重复', '独有', '重复');
    expect(locateRenderedPrompts(['重复', '重复', '独有'], [first, second, third]))
      .toEqual([first, third, second]);
  });

  it('returns null for questions the page has not rendered yet', () => {
    const rendered = messages('第三问', '第四问');
    expect(locateRenderedPrompts(['第一问', '第二问', '第三问', '第四问'], rendered))
      .toEqual([null, null, rendered[0], rendered[1]]);
  });

  it('falls back to position when the counts line up but the text does not', () => {
    const rendered = messages('渲染后被改写的提问');
    expect(locateRenderedPrompts(['接口返回的提问'], rendered)).toEqual([rendered[0]]);
  });

  it('marks the last question at or above the viewport middle as current', () => {
    const [above, alsoAbove, below] = messages('一', '二', '三');
    stubRect(above, -200);
    stubRect(alsoAbove, 100);
    stubRect(below, 600);

    expect(currentPromptIndex([above, alsoAbove, below], 800)).toBe(1);
    expect(currentPromptIndex([null, null, below], 800)).toBe(-1);
  });
});

describe('preview panel behaviour', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/c/current');
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => vi.useRealTimers());

  it('shows a right-edge rail and opens the current conversation from it', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/g/g-example/c/thread-1');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mapping: { user: { message: { author: { role: 'user' }, content: { parts: ['第一条提问'] } } }, latest: { message: { author: { role: 'user' }, content: { parts: ['回答预览'] } } } } }) });
    const remove = installHistoryPreview(chatGptSite, document, { delayMs: 180, fetcher });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth }));
    expect(rail().className).toContain('is-visible');

    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(180);
    expect(fetcher).toHaveBeenCalledWith('/backend-api/conversation/thread-1', expect.objectContaining({ credentials: 'include' }));
    expect(shadow().textContent).toContain('第一条提问');

    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(180);
    expect(fetcher).toHaveBeenCalledTimes(1);
    remove();
  });

  it('refetches the list after the conversation gains a new question', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/c/thread-1');
    document.body.innerHTML = '<article data-message-author-role="user">第一条提问</article>';
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mapping: {} }) });
    const remove = installHistoryPreview(chatGptSite, document, { delayMs: 0, fetcher });

    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    document.body.insertAdjacentHTML('beforeend', '<article data-message-author-role="user">第二条提问</article>');
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(shadow().textContent).toContain('第二条提问');
    remove();
  });

  it('opens with rendered user messages when the conversation endpoint is unavailable', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/g/g-example/c/thread-1');
    document.body.innerHTML = '<article data-message-author-role="user">页面中的提问</article>';
    const remove = installHistoryPreview(chatGptSite, document, { delayMs: 180, fetcher: vi.fn().mockRejectedValue(new Error('offline')) });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth }));
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(180);
    expect(shadow().textContent).toContain('页面中的提问');
    remove();
  });

  it('scrolls to the matching message and closes when an entry is clicked', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <article data-message-author-role="user">第一条提问</article>
      <article data-message-author-role="user">第二条提问</article>`;
    const remove = installHistoryPreview(chatGptSite, document, {
      delayMs: 0,
      fetcher: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    });
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);

    const [other, target] = Array.from(document.querySelectorAll('[data-message-author-role="user"]')) as HTMLElement[];
    other.scrollIntoView = vi.fn();
    target.scrollIntoView = vi.fn();
    entries()[1].click();

    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(other.scrollIntoView).not.toHaveBeenCalled();
    expect(target.style.outline).toContain('2px solid');
    expect(shadow().querySelector('.preview')!.className).not.toContain('is-open');

    await vi.advanceTimersByTimeAsync(1600);
    expect(target.style.outline).toBe('');
    remove();
  });

  it('snaps into place when smooth scrolling never moves the message', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<article data-message-author-role="user">唯一的提问</article>';
    const remove = installHistoryPreview(chatGptSite, document, {
      delayMs: 0,
      fetcher: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    });
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);

    const target = document.querySelector('[data-message-author-role="user"]') as HTMLElement;
    target.scrollIntoView = vi.fn();
    entries()[0].click();
    // jsdom reports an all-zero rect, so the message counts as off screen.
    await vi.advanceTimersByTimeAsync(600);

    expect(target.scrollIntoView).toHaveBeenNthCalledWith(1, { block: 'center', behavior: 'smooth' });
    expect(target.scrollIntoView).toHaveBeenNthCalledWith(2, { block: 'center' });
    remove();
  });

  it('disables entries whose message is not on the page and explains why', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/c/thread-1');
    document.body.innerHTML = '<article data-message-author-role="user">已渲染的提问</article>';
    const remove = installHistoryPreview(chatGptSite, document, {
      delayMs: 0,
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          mapping: {
            older: { message: { create_time: 1, author: { role: 'user' }, content: { parts: ['尚未加载的旧提问'] } } },
            shown: { message: { create_time: 2, author: { role: 'user' }, content: { parts: ['已渲染的提问'] } } },
          },
        }),
      }),
    });
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);

    const [older, shown] = entries();
    expect(older.disabled).toBe(true);
    expect(older.title).toContain('向上滚动加载更早的消息');
    expect(shown.disabled).toBe(false);
    remove();
  });

  it('lists Gemini questions straight from the page without any request', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/app/abc123');
    document.body.innerHTML = `
      <user-query>Gemini 的第一个问题</user-query>
      <user-query>Gemini 的第二个问题</user-query>`;
    const fetcher = vi.fn();
    const remove = installHistoryPreview(geminiSite, document, { delayMs: 0, fetcher });

    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);

    expect(fetcher).not.toHaveBeenCalled();
    expect(entries().map(entry => entry.textContent))
      .toEqual(['Gemini 的第一个问题', 'Gemini 的第二个问题']);
    expect(entries().every(entry => !entry.disabled)).toBe(true);
    remove();
  });

  it('keeps wheel scrolling inside the preview until the list reaches an edge', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/c/thread-1');
    const remove = installHistoryPreview(chatGptSite, document, {
      delayMs: 0,
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mapping: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [
          `user-${index}`,
          { message: { create_time: index, author: { role: 'user' }, content: { parts: [`第 ${index + 1} 条提问`] } } },
        ])) }),
      }),
    });
    rail().dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(0);
    const panel = shadow().querySelector('.preview') as HTMLDivElement;
    Object.defineProperties(panel, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 480 },
    });
    Object.defineProperty(panel, 'scrollTop', { configurable: true, value: 0, writable: true });

    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 60 });
    panel.dispatchEvent(wheel);
    expect(panel.scrollTop).toBe(60);
    expect(wheel.defaultPrevented).toBe(true);

    panel.scrollTop = 360;
    const atBottom = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 60 });
    panel.dispatchEvent(atBottom);
    expect(atBottom.defaultPrevented).toBe(false);
    remove();
  });
});
