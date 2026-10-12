import type {
  AnswerSnapshot,
  ConversationAdapter,
  ConversationRecord,
  RichTextBlock,
  SiteDefinition,
  SiteName,
} from './types';
import { SITES, chatGptSite, geminiSite } from './sites';

const digest = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
};

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const richBlocks = (element: HTMLElement): RichTextBlock[] => {
  const nodes = Array.from(element.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre'));
  const blocks = nodes.map(node => {
    const tag = node.tagName.toLowerCase();
    const link = node.querySelector('a[href]');
    return {
      type: tag.startsWith('h') ? 'heading' as const : tag === 'li' ? 'list_item' as const : tag === 'blockquote' ? 'quote' as const : tag === 'pre' ? 'code' as const : 'paragraph' as const,
      text: text(node),
      language: tag === 'pre' ? node.querySelector('code')?.className.match(/language-([\w+-]+)/)?.[1] : undefined,
      href: link?.getAttribute('href') ?? undefined,
    };
  }).filter(block => block.text);
  const fallback: RichTextBlock[] = text(element) ? [{ type: 'paragraph', text: text(element) }] : [];
  return blocks.length ? blocks : fallback;
};

const routeId = (site: SiteName) => {
  const match = location.pathname.match(/(?:conversation|c|app)\/([^/?#]+)/i);
  return `${site}:${match?.[1] ?? digest(location.pathname + location.search)}`;
};

const conversation = (site: SiteName): ConversationRecord => ({
  id: routeId(site),
  site,
  title: document.title.replace(/\s*[·|-]\s*(ChatGPT|Gemini).*$/i, '').trim() || '未命名对话',
  sourceUrl: location.href,
});

export const createConversationAdapter = (definition: SiteDefinition): ConversationAdapter => {
  const site = definition.name;
  const { messageSelector, assistantSelector, userSelector, actionBarSelectors } = definition.conversation;
  const messages = () => Array.from(document.querySelectorAll(messageSelector))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter(message => message.matches(assistantSelector));
  const locator = (message: HTMLElement) => message.getAttribute('data-message-id')
    || message.id
    || digest(text(message));
  const find = (target: string) => messages().find(message => locator(message) === target) ?? null;
  return {
    site,
    getConversation: () => conversation(site),
    messages,
    actionBar: message => {
      for (const selector of actionBarSelectors) {
        const found = message.querySelector(selector);
        if (found instanceof HTMLElement) return found;
      }
      return message.lastElementChild instanceof HTMLElement ? message.lastElementChild : null;
    },
    snapshot: message => {
      const all = Array.from(document.querySelectorAll(messageSelector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
      const index = all.indexOf(message);
      const question = [...all.slice(0, index)].reverse().find(item => item.matches(userSelector));
      const answer = richBlocks(message);
      const questionBlocks = question ? richBlocks(question) : [];
      if (!answer.length) return null;
      return {
        question: questionBlocks,
        answer,
        questionText: questionBlocks.map(block => block.text).join('\n'),
        answerText: answer.map(block => block.text).join('\n'),
        capturedAt: Date.now(),
        sourceUrl: location.href,
      } satisfies AnswerSnapshot;
    },
    locator,
    find,
    focus: target => {
      const message = find(target);
      if (!message) return false;
      message.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const previousOutline = message.style.outline;
      const previousOffset = message.style.outlineOffset;
      message.style.outline = '2px solid #3f667f';
      message.style.outlineOffset = '4px';
      window.setTimeout(() => { message.style.outline = previousOutline; message.style.outlineOffset = previousOffset; }, 1600);
      return true;
    },
  };
};

const ADAPTERS = new Map(SITES.map(definition => [definition.name, createConversationAdapter(definition)]));

export const chatGptConversationAdapter = ADAPTERS.get(chatGptSite.name)!;
export const geminiConversationAdapter = ADAPTERS.get(geminiSite.name)!;

export const getConversationAdapter = (site: SiteName): ConversationAdapter => ADAPTERS.get(site)
  ?? chatGptConversationAdapter;
