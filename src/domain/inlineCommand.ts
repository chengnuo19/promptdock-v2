import type { ComposerRange } from '../types';

export type InlineCommand = { query: string; range: ComposerRange };

/** Returns a command only when // starts a line or follows whitespace. */
export const findInlineCommand = (text: string, caret: number): InlineCommand | null => {
  const prefix = text.slice(0, Math.max(0, caret));
  const match = /(^|[\s\n])\/\/([^\n]*)$/.exec(prefix);
  if (!match) return null;
  const commandStart = prefix.length - match[0].length + match[1].length;
  return { query: match[2].trim(), range: { start: commandStart, end: caret } };
};

