// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chatGptAdapter, geminiAdapter, getAdapter } from './adapters';

describe('site adapters', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
  });

  // jsdom has no execCommand, so stand in for the rich editors that do implement it.
  const stubExecCommand = (implementation: (value: string) => boolean) => {
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (_command: string, _ui: boolean, value: string) => implementation(value),
    });
  };

  it('finds and reads the ChatGPT composer and its form anchor', () => {
    document.body.innerHTML = '<form id="composer-form"><textarea id="prompt-textarea">草稿</textarea></form>';
    const composer = chatGptAdapter.findComposer();

    expect(composer).toBeInstanceOf(HTMLTextAreaElement);
    expect(chatGptAdapter.readText(composer!)).toBe('草稿');
    expect(chatGptAdapter.findAnchor(composer!).id).toBe('composer-form');
  });

  it('appends or replaces text without submitting', () => {
    document.body.innerHTML = '<form><textarea id="prompt-textarea">草稿</textarea></form>';
    const composer = chatGptAdapter.findComposer()!;

    expect(chatGptAdapter.writeText('追加', 'append', composer)).toEqual({ ok: true });
    expect(chatGptAdapter.readText(composer)).toBe('草稿\n\n追加');
    expect(chatGptAdapter.writeText('替换', 'replace', composer)).toEqual({ ok: true });
    expect(chatGptAdapter.readText(composer)).toBe('替换');
  });

  it('reads and replaces a local textarea range', () => {
    document.body.innerHTML = '<textarea id="prompt-textarea">前 //翻译 后</textarea>';
    const composer = chatGptAdapter.findComposer() as HTMLTextAreaElement;
    composer.selectionStart = composer.selectionEnd = 6;
    expect(chatGptAdapter.readSelection(composer)?.range).toEqual({ start: 6, end: 6 });
    expect(chatGptAdapter.replaceRange('专业翻译', { start: 2, end: 6 }, composer)).toEqual({ ok: true });
    expect(composer.value).toBe('前 专业翻译 后');
    expect(composer.selectionStart).toBe(6);
  });

  it('keeps a rich editor document that already holds the inserted text', () => {
    document.body.innerHTML = '<form><div id="prompt-textarea" contenteditable="true"></div></form>';
    const composer = chatGptAdapter.findComposer()!;
    // ProseMirror keeps one block per line, so textContent drops the newlines.
    stubExecCommand(value => {
      composer.replaceChildren(...value.split('\n').map(line => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        return paragraph;
      }));
      return true;
    });

    expect(chatGptAdapter.writeText('第一行\n\n第二行', 'replace', composer)).toEqual({ ok: true });
    expect(composer.querySelectorAll('p')).toHaveLength(3);
  });

  it('rewrites a rich editor document when the insert produced different text', () => {
    document.body.innerHTML = '<form><div id="prompt-textarea" contenteditable="true"></div></form>';
    const composer = chatGptAdapter.findComposer()!;
    stubExecCommand(() => true);

    expect(chatGptAdapter.writeText('提示词', 'replace', composer)).toEqual({ ok: true });
    expect(composer.textContent).toBe('提示词');
  });

  it('finds a visible Gemini rich text editor', () => {
    document.body.innerHTML = '<div class="input-area-container"><div class="ql-editor" contenteditable="true">问题</div></div>';
    const editor = document.querySelector('.ql-editor') as HTMLElement;
    editor.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 80, width: 400, height: 80,
      toJSON: () => ({}),
    });
    const composer = geminiAdapter.findComposer();

    expect(composer?.classList.contains('ql-editor')).toBe(true);
    expect(geminiAdapter.readText(composer!)).toBe('问题');
    expect(geminiAdapter.findAnchor(composer!).classList.contains('input-area-container')).toBe(true);
  });

  it('returns a clear image attachment failure when no file input exists', async () => {
    expect(await geminiAdapter.attachFiles([new File(['x'], 'a.png', { type: 'image/png' })]))
      .toEqual({ ok: false, reason: 'upload_input_not_found' });
  });

  it('selects adapters by supported hostname only', () => {
    expect(getAdapter('chatgpt.com')?.name).toBe('chatgpt');
    expect(getAdapter('gemini.google.com')?.name).toBe('gemini');
    expect(getAdapter('example.com')).toBeNull();
  });
});
