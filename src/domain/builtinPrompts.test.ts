import { describe, expect, it } from 'vitest';
import { BUILTIN_FOLDERS, BUILTIN_PROMPTS } from './builtinPrompts';

describe('builtin prompt library', () => {
  it('ships exactly twenty unique Chinese templates across five folders', () => {
    expect(BUILTIN_PROMPTS).toHaveLength(20);
    expect(new Set(BUILTIN_PROMPTS.map(prompt => prompt.id)).size).toBe(20);
    expect(BUILTIN_FOLDERS.map(folder => folder.name)).toEqual([
      '写作办公',
      '学习科研',
      '数学建模',
      '编程开发',
      '分析规划',
    ]);
    expect(new Set(BUILTIN_PROMPTS.map(prompt => prompt.folderId))).toEqual(
      new Set(BUILTIN_FOLDERS.map(folder => folder.id)),
    );
  });
});

