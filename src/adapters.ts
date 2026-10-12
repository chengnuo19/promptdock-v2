import type {
  AttachFilesResult,
  ComposerRange,
  ComposerSelection,
  InsertMode,
  InsertResult,
  SiteAdapter,
  SiteDefinition,
} from './types';
import { chatGptSite, geminiSite, getSite } from './sites';
import { findEditableInside } from './sites/dom';

const readText = (composer: HTMLElement): string => {
  const target = findEditableInside(composer);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
  return target.innerText || target.textContent || '';
};

const textOffset = (root: Node, target: Node, targetOffset: number): number => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === target) return total + targetOffset;
    total += node.textContent?.length ?? 0;
  }
  return total;
};

const readSelection = (composer: HTMLElement): ComposerSelection | null => {
  const target = findEditableInside(composer);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    return { text: target.value, range: { start, end }, caretRect: target.getBoundingClientRect() };
  }
  const selection = window.getSelection();
  if (!selection?.rangeCount || !target.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return {
    text: readText(target),
    range: {
      start: textOffset(target, range.startContainer, range.startOffset),
      end: textOffset(target, range.endContainer, range.endOffset),
    },
    caretRect: rect.width || rect.height ? rect : target.getBoundingClientRect(),
  };
};

const writeTextControl = (
  target: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string,
  insertedText: string,
) => {
  target.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
  if (setter) setter.call(target, nextValue);
  else target.value = nextValue;
  target.selectionStart = target.selectionEnd = nextValue.length;
  target.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: insertedText,
  }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Rich editors such as ProseMirror split lines into separate blocks, so their
 * textContent drops the newlines we asked for. Compare on collapsed whitespace
 * to avoid replacing a correct editor document with a plain text node.
 */
const sameEditorText = (actual: string, expected: string) => actual.replace(/\s+/g, '') === expected.replace(/\s+/g, '');

const writeContentEditable = (target: HTMLElement, nextValue: string, insertedText: string) => {
  target.focus();
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const beforeInput = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: insertedText,
  });
  const allowed = target.dispatchEvent(beforeInput);
  const execCommand = document.execCommand?.bind(document);
  const inserted = allowed && execCommand ? execCommand('insertText', false, insertedText) : false;
  if (!inserted || !sameEditorText(target.textContent ?? '', nextValue)) target.textContent = nextValue;
  target.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: insertedText,
  }));
};

const writeComposerText = (
  text: string,
  mode: InsertMode,
  composer: HTMLElement,
): InsertResult => {
  try {
    const target = findEditableInside(composer);
    const current = readText(target);
    const nextValue = mode === 'append' && current.trim() ? `${current}\n\n${text}` : text;
    const insertedText = mode === 'append' && current.trim() ? `\n\n${text}` : text;

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      writeTextControl(target, nextValue, insertedText);
    } else {
      writeContentEditable(target, nextValue, insertedText);
    }
    return { ok: true };
  } catch (error) {
    console.error('PromptDock failed to write composer text:', error);
    return { ok: false, reason: 'write_failed' };
  }
};

const replaceRange = (text: string, range: ComposerRange, composer: HTMLElement): InsertResult => {
  try {
    const target = findEditableInside(composer);
    const current = readText(target);
    const start = Math.max(0, Math.min(range.start, current.length));
    const end = Math.max(start, Math.min(range.end, current.length));
    const next = `${current.slice(0, start)}${text}${current.slice(end)}`;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      writeTextControl(target, next, text);
      target.selectionStart = target.selectionEnd = start + text.length;
    } else {
      writeContentEditable(target, next, text);
      const selection = window.getSelection();
      const node = target.firstChild;
      if (selection && node) {
        const caret = document.createRange();
        caret.setStart(node, Math.min(start + text.length, node.textContent?.length ?? 0));
        caret.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caret);
      }
    }
    return { ok: true };
  } catch (error) {
    console.error('PromptDock failed to replace composer range:', error);
    return { ok: false, reason: 'write_failed' };
  }
};

const focusComposer = (composer: HTMLElement) => findEditableInside(composer).focus();

const findFileInput = (selectors: string[]): HTMLInputElement | null => {
  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    if (candidate instanceof HTMLInputElement && candidate.type === 'file') return candidate;
  }
  return null;
};

const attachFiles = async (
  input: HTMLInputElement | null,
  files: File[],
): Promise<AttachFilesResult> => {
  if (!input) return { ok: false, reason: 'upload_input_not_found' };
  if (files.length === 0) return { ok: false, reason: 'site_rejected_files' };

  try {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, status: 'attempted' };
  } catch (error) {
    console.error('PromptDock failed to attach images:', error);
    return { ok: false, reason: 'unknown' };
  }
};

export const createSiteAdapter = (site: SiteDefinition): SiteAdapter => ({
  name: site.name,
  findComposer: site.composer.find,
  findAnchor: composer => composer.closest(site.composer.anchorSelector) instanceof HTMLElement
    ? composer.closest(site.composer.anchorSelector) as HTMLElement
    : composer,
  readText,
  readSelection,
  replaceRange,
  focusComposer,
  writeText: writeComposerText,
  attachFiles: files => attachFiles(findFileInput(site.composer.fileInputSelectors), files),
});

export const chatGptAdapter = createSiteAdapter(chatGptSite);
export const geminiAdapter = createSiteAdapter(geminiSite);

export const getAdapter = (hostname = window.location.hostname): SiteAdapter | null => {
  const site = getSite(hostname);
  return site ? createSiteAdapter(site) : null;
};
