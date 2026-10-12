import type { SiteDefinition } from './types';

export type HistoryPreview = {
  prompts: string[];
};

type PreviewFetcher = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

type HistoryPreviewOptions = {
  delayMs?: number;
  fetcher?: PreviewFetcher;
};

const PREVIEW_HOST_ID = 'promptdock-history-preview';
const MAX_PROMPT_COUNT = 80;
const EDGE_TRIGGER_WIDTH = 32;
const HIDE_DELAY_MS = 180;
const HIGHLIGHT_MS = 1600;
const SMOOTH_FALLBACK_MS = 600;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim();

const partText = (part: unknown): string => {
  if (typeof part === 'string') return part;
  if (!isRecord(part)) return '';
  return typeof part.text === 'string' ? part.text : '';
};

const messageText = (message: Record<string, unknown>) => {
  const content = isRecord(message.content) ? message.content : null;
  if (!content || !Array.isArray(content.parts)) return '';
  return cleanText(content.parts.map(partText).filter(Boolean).join(' '));
};

export const parseChatGptHistoryPreview = (payload: unknown): HistoryPreview | null => {
  if (!isRecord(payload) || !isRecord(payload.mapping)) return null;
  const prompts = Object.values(payload.mapping)
    .map((node, index) => {
      if (!isRecord(node) || !isRecord(node.message) || !isRecord(node.message.author)) return null;
      const createdAt = typeof node.message.create_time === 'number' ? node.message.create_time : index;
      return { role: node.message.author.role, text: messageText(node.message), createdAt, index };
    })
    .filter((message): message is { role: unknown; text: string; createdAt: number; index: number } => message !== null)
    .filter(message => message.role === 'user' && message.text)
    .sort((left, right) => left.createdAt - right.createdAt || left.index - right.index)
    .map(message => message.text)
    // Keep the most recent questions: in a long conversation those are the ones
    // worth going back to, and they are what the earlier `slice(0, n)` dropped.
    .slice(-MAX_PROMPT_COUNT);
  return prompts.length ? { prompts } : null;
};

const userMessages = (doc: Document, site: SiteDefinition): HTMLElement[] => Array
  .from(doc.querySelectorAll(site.conversation.userSelector))
  .filter((element): element is HTMLElement => element instanceof HTMLElement);

const previewFromRenderedMessages = (doc: Document, site: SiteDefinition): HistoryPreview | null => {
  const prompts = userMessages(doc, site)
    .map(element => cleanText(element.textContent ?? ''))
    .filter(Boolean)
    .slice(-MAX_PROMPT_COUNT);
  return prompts.length ? { prompts } : null;
};

const fetchPreview = async (site: SiteDefinition, conversationId: string, fetcher: PreviewFetcher) => {
  const path = site.history.conversationPath;
  if (!path) return null;
  try {
    const response = await fetcher(path(conversationId), {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return parseChatGptHistoryPreview(await response.json());
  } catch {
    return null;
  }
};

/**
 * The endpoint can list questions that are not in the page yet, so entries are
 * matched to rendered messages by their text, falling back to position.
 */
export const locateRenderedPrompts = (
  prompts: readonly string[],
  messages: readonly HTMLElement[],
): (HTMLElement | null)[] => {
  const byText = new Map<string, HTMLElement[]>();
  messages.forEach(message => {
    const key = cleanText(message.textContent ?? '');
    byText.set(key, [...(byText.get(key) ?? []), message]);
  });

  const aligned = prompts.length === messages.length;
  return prompts.map((prompt, index) => {
    const matches = byText.get(prompt);
    if (matches?.length) return matches.shift() ?? null;
    return aligned ? messages[index] : null;
  });
};

/** Which entry the reader is currently looking at, so the panel doubles as a map. */
export const currentPromptIndex = (
  located: readonly (HTMLElement | null)[],
  viewportHeight: number,
): number => {
  const anchor = viewportHeight / 2;
  let current = -1;
  located.forEach((element, index) => {
    if (element && element.getBoundingClientRect().top <= anchor) current = index;
  });
  return current;
};

const previewStyle = `
  :host { all: initial; height: 0; pointer-events: auto; position: fixed; right: 0; top: 0; width: 0; z-index: 2147483001; }
  .rail { background: repeating-linear-gradient(to bottom, #b4b4b4 0 3px, transparent 3px 12px); border: 0; border-radius: 999px; cursor: pointer; display: none; height: 168px; opacity: .9; padding: 0; position: fixed; right: 16px; top: calc(50% - 84px); transition: opacity 120ms ease-out; width: 22px; }
  .rail.is-visible { display: block; }
  .rail:focus-visible { outline: 2px solid #d8d8d8; outline-offset: 3px; }
  .preview { background: #3a3a3a; border: 1px solid rgb(255 255 255 / 7%); border-radius: 24px; box-shadow: 0 18px 46px rgb(0 0 0 / 32%); box-sizing: border-box; color: #f4f4f4; display: none; font: 16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; max-height: min(720px, calc(100vh - 24px)); overflow-y: auto; overscroll-behavior: contain; padding: 10px; position: fixed; right: 42px; scrollbar-color: #6d6d6d transparent; scrollbar-gutter: stable; top: 50%; touch-action: pan-y; transform: translateY(-50%); width: min(480px, calc(100vw - 54px)); }
  .preview.is-open { display: block; }
  .prompt { background: transparent; border: 0; border-radius: 14px; box-sizing: border-box; color: inherit; cursor: pointer; display: block; font: inherit; padding: 12px 14px; text-align: left; width: 100%; }
  /* A button cannot be a -webkit-box container, so the clamp lives on the text. */
  .prompt-text { -webkit-box-orient: vertical; -webkit-line-clamp: 2; display: -webkit-box; line-clamp: 2; overflow: hidden; }
  .prompt + .prompt { margin-top: 3px; }
  .prompt:hover:not(:disabled), .prompt:focus-visible { background: #474747; }
  .prompt:hover:not(:disabled) .prompt-text, .prompt:focus-visible .prompt-text { -webkit-line-clamp: unset; line-clamp: unset; }
  .prompt:focus-visible { outline: 2px solid #d8d8d8; outline-offset: -2px; }
  .prompt.is-current { background: #474747; box-shadow: inset 3px 0 0 #9bb8c9; }
  .prompt:disabled { cursor: default; opacity: .55; }
  .status { color: #c9c9c9; padding: 12px 14px; }
  .preview::-webkit-scrollbar { width: 8px; }
  .preview::-webkit-scrollbar-thumb { background: #6d6d6d; border: 2px solid #3a3a3a; border-radius: 8px; }
`;

type PreviewElements = {
  host: HTMLElement;
  rail: HTMLButtonElement;
  panel: HTMLDivElement;
};

const ensurePreviewHost = (doc: Document): PreviewElements => {
  const existing = doc.getElementById(PREVIEW_HOST_ID);
  if (existing instanceof HTMLElement && existing.shadowRoot) {
    const rail = existing.shadowRoot.querySelector('.rail');
    const panel = existing.shadowRoot.querySelector('.preview');
    if (rail instanceof HTMLButtonElement && panel instanceof HTMLDivElement) return { host: existing, rail, panel };
  }
  existing?.remove();
  const host = doc.createElement('div');
  host.id = PREVIEW_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = previewStyle;
  const rail = doc.createElement('button');
  rail.type = 'button';
  rail.className = 'rail';
  rail.setAttribute('aria-label', '显示当前对话的提问列表');
  const panel = doc.createElement('div');
  panel.className = 'preview';
  panel.setAttribute('role', 'list');
  panel.setAttribute('aria-label', '当前对话中的提问');
  shadow.append(style, rail, panel);
  doc.body.appendChild(host);
  return { host, rail, panel };
};

const isOnScreen = (message: HTMLElement) => {
  const rect = message.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
};

const scrollToMessage = (message: HTMLElement) => {
  message.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // Smooth scrolling is inert in some environments, which would leave the click
  // looking like it did nothing. Snap into place if the animation never ran.
  window.setTimeout(() => {
    if (!isOnScreen(message)) message.scrollIntoView({ block: 'center' });
  }, SMOOTH_FALLBACK_MS);

  const previousOutline = message.style.outline;
  const previousOffset = message.style.outlineOffset;
  message.style.outline = '2px solid #9bb8c9';
  message.style.outlineOffset = '4px';
  window.setTimeout(() => {
    message.style.outline = previousOutline;
    message.style.outlineOffset = previousOffset;
  }, HIGHLIGHT_MS);
};

const showStatus = (panel: HTMLDivElement, text: string, doc: Document) => {
  const status = doc.createElement('p');
  status.className = 'status';
  status.setAttribute('role', 'status');
  status.textContent = text;
  panel.replaceChildren(status);
};

const pixelScrollDelta = (event: WheelEvent, panel: HTMLDivElement) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * panel.clientHeight;
  return event.deltaY;
};

export const installHistoryPreview = (
  site: SiteDefinition,
  doc = document,
  options: HistoryPreviewOptions = {},
) => {
  const delayMs = options.delayMs ?? 160;
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const cache = new Map<string, HistoryPreview>();
  const { host, rail, panel } = ensurePreviewHost(doc);
  let hideTimer = 0;
  let openTimer = 0;
  let loadToken = 0;
  let panelHovered = false;

  const cancelHide = () => window.clearTimeout(hideTimer);
  const cancelOpen = () => window.clearTimeout(openTimer);
  const close = () => {
    loadToken += 1;
    panel.classList.remove('is-open');
    rail.classList.remove('is-visible');
  };
  const scheduleClose = () => {
    cancelHide();
    hideTimer = window.setTimeout(() => {
      if (!panelHovered) close();
    }, HIDE_DELAY_MS);
  };

  const renderPrompts = (preview: HistoryPreview) => {
    const located = locateRenderedPrompts(preview.prompts, userMessages(doc, site));
    const current = currentPromptIndex(located, window.innerHeight);
    panel.replaceChildren(...preview.prompts.map((prompt, index) => {
      const message = located[index];
      const item = doc.createElement('button');
      item.type = 'button';
      item.className = index === current ? 'prompt is-current' : 'prompt';
      item.setAttribute('role', 'listitem');
      const text = doc.createElement('span');
      text.className = 'prompt-text';
      text.textContent = prompt;
      item.appendChild(text);
      if (message) {
        item.title = prompt;
        item.addEventListener('click', () => {
          close();
          scrollToMessage(message);
        });
      } else {
        item.disabled = true;
        item.title = `${prompt}\n\n向上滚动加载更早的消息后可跳转。`;
      }
      return item;
    }));
  };

  const open = () => {
    cancelOpen();
    cancelHide();
    const token = ++loadToken;
    const rendered = previewFromRenderedMessages(doc, site);
    const conversationId = site.history.conversationId(window.location.href);
    if (!conversationId) {
      if (!rendered) return close();
      renderPrompts(rendered);
      panel.classList.add('is-open');
      return;
    }
    // Include the rendered question count so new turns invalidate the cached list.
    const cacheKey = `${conversationId}:${rendered?.prompts.length ?? 0}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      renderPrompts(cached);
      panel.classList.add('is-open');
      return;
    }
    if (rendered) renderPrompts(rendered);
    else showStatus(panel, '正在读取当前对话…', doc);
    panel.classList.add('is-open');
    void fetchPreview(site, conversationId, fetcher).then(preview => {
      if (token !== loadToken) return;
      const result = preview ?? rendered;
      if (!result) return showStatus(panel, '暂时无法读取当前对话。', doc);
      cache.set(cacheKey, result);
      renderPrompts(result);
    });
  };
  const scheduleOpen = () => {
    cancelHide();
    cancelOpen();
    openTimer = window.setTimeout(open, delayMs);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.clientX >= window.innerWidth - EDGE_TRIGGER_WIDTH) {
      cancelHide();
      rail.classList.add('is-visible');
    } else if (!panelHovered) {
      scheduleClose();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  const onRailLeave = () => { cancelOpen(); scheduleClose(); };
  const onPanelWheel = (event: WheelEvent) => {
    const delta = pixelScrollDelta(event, panel);
    const maxScrollTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, panel.scrollTop + delta));
    if (!maxScrollTop || nextScrollTop === panel.scrollTop) return;
    event.preventDefault();
    event.stopPropagation();
    panel.scrollTop = nextScrollTop;
  };

  rail.addEventListener('mouseenter', scheduleOpen);
  rail.addEventListener('focus', open);
  rail.addEventListener('mouseleave', onRailLeave);
  rail.addEventListener('click', open);
  panel.addEventListener('mouseenter', () => { panelHovered = true; cancelHide(); });
  panel.addEventListener('mouseleave', () => { panelHovered = false; scheduleClose(); });
  // Keyboard users move focus into the panel, which fires no mouseenter.
  panel.addEventListener('focusin', cancelHide);
  panel.addEventListener('wheel', onPanelWheel, { passive: false });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKeyDown);
  return () => {
    cancelHide();
    cancelOpen();
    rail.removeEventListener('mouseenter', scheduleOpen);
    rail.removeEventListener('focus', open);
    rail.removeEventListener('mouseleave', onRailLeave);
    rail.removeEventListener('click', open);
    panel.removeEventListener('focusin', cancelHide);
    panel.removeEventListener('wheel', onPanelWheel);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('keydown', onKeyDown);
    host.remove();
  };
};
