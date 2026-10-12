import { describe, expect, it } from 'vitest';
import { findInlineCommand } from './inlineCommand';

describe('inline // command recognition', () => {
  it('accepts commands at the start, after whitespace, and after a newline', () => {
    expect(findInlineCommand('//翻译', 4)).toEqual({ query: '翻译', range: { start: 0, end: 4 } });
    expect(findInlineCommand('请用 //翻译', 7)).toEqual({ query: '翻译', range: { start: 3, end: 7 } });
    expect(findInlineCommand('上一行\n// code', 11)).toEqual({ query: 'code', range: { start: 4, end: 11 } });
  });

  it('does not trigger for urls, paths, or a finished command before the caret', () => {
    expect(findInlineCommand('https://example.com', 19)).toBeNull();
    expect(findInlineCommand('C://folder', 10)).toBeNull();
    expect(findInlineCommand('//one\ntext', 10)).toBeNull();
  });
});
