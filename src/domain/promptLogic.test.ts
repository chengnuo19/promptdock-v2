import { describe, expect, it } from 'vitest';
import {
  addTagsToPrompts,
  deleteFolder,
  deletePrompt,
  deletePrompts,
  duplicatePrompt,
  extractVariables,
  fillPromptVariables,
  initialVariableValues,
  movePromptsToFolder,
  rankPrompts,
  recordPromptUse,
  rememberVariableValues,
  resolvePrompts,
  savePrompt,
} from './promptLogic';
import { createDefaultState } from './state';

describe('prompt variables', () => {
  it('extracts trimmed variables once in first-seen order', () => {
    expect(extractVariables('{{ 主题 }} / {{语气}} / {{主题}}')).toEqual([
      { name: '主题', defaultValue: '' },
      { name: '语气', defaultValue: '' },
    ]);
  });

  it('reads a default value after the first half-width or full-width colon', () => {
    expect(extractVariables('{{语言:简体中文}} {{比例：3:2}}')).toEqual([
      { name: '语言', defaultValue: '简体中文' },
      { name: '比例', defaultValue: '3:2' },
    ]);
  });

  it('fills a variable from its default when the user leaves it empty', () => {
    expect(fillPromptVariables('用{{语言:中文}}回答{{主题}}', { 主题: 'AI' }))
      .toEqual({ ok: true, text: '用中文回答AI' });
    expect(fillPromptVariables('用{{语言:中文}}回答', { 语言: '英文' }))
      .toEqual({ ok: true, text: '用英文回答' });
  });

  it('prefills remembered values ahead of defaults', () => {
    expect(initialVariableValues('{{语言:中文}}{{语气}}', { 语气: '正式' }))
      .toEqual({ 语言: '中文', 语气: '正式' });
  });

  it('reports missing variables and fills complete values', () => {
    expect(fillPromptVariables('写一篇{{主题}}的{{语气}}文章', { 主题: 'AI' })).toEqual({
      ok: false,
      missing: ['语气'],
    });
    expect(fillPromptVariables('写一篇{{主题}}的{{语气}}文章', { 主题: 'AI', 语气: '严谨' })).toEqual({
      ok: true,
      text: '写一篇AI的严谨文章',
    });
  });
});

describe('prompt resolution and search', () => {
  it('applies builtin overrides and hides deleted builtins', () => {
    const state = createDefaultState();
    const first = resolvePrompts(state)[0];
    state.builtinOverrides[first.id] = { title: '已修改', updatedAt: 1 };
    state.hiddenBuiltinIds.push(resolvePrompts(state)[1].id);

    const resolved = resolvePrompts(state);
    expect(resolved[0].title).toBe('已修改');
    expect(resolved).toHaveLength(19);
  });

  it('searches title, content, and tags case-insensitively', () => {
    const prompts = resolvePrompts(createDefaultState());
    expect(rankPrompts(prompts, 'CODE').some(prompt => prompt.tags.includes('code'))).toBe(true);
    expect(rankPrompts(prompts, '赛题').length).toBeGreaterThan(0);
  });

  it('ranks title matches before tags and content, then favorites and usage', () => {
    const base = { folderId: '', tags: [], source: 'user' as const, createdAt: 1, updatedAt: 1 };
    const prompts = [
      { ...base, id: 'content', title: '其他', content: 'alpha', tags: [] },
      { ...base, id: 'tag', title: '其他二', content: '内容', tags: ['alpha'] },
      { ...base, id: 'prefix', title: 'Alpha 写作', content: '内容', tags: [] },
      { ...base, id: 'exact', title: 'alpha', content: '内容', tags: [] },
      { ...base, id: 'tie-a', title: 'Alpha A', content: '内容', tags: [] },
      { ...base, id: 'tie-b', title: 'Alpha B', content: '内容', tags: [] },
    ];
    expect(rankPrompts(prompts, 'ALPHA', { favoriteIds: ['tie-b'], usage: { 'tie-a': { count: 3, lastUsedAt: 9 } } })
      .map(prompt => prompt.id))
      .toEqual(['exact', 'tie-b', 'tie-a', 'prefix', 'tag', 'content']);
  });
});

describe('prompt CRUD', () => {
  it('creates and updates a user prompt', () => {
    const state = createDefaultState();
    const created = savePrompt(state, {
      title: '个人模板', content: '内容', folderId: '', tags: ['个人'], source: 'user',
    }, 100, 'user-1');
    expect(created.userPrompts[0]).toMatchObject({ id: 'user-1', title: '个人模板', createdAt: 100 });

    const updated = savePrompt(created, { ...created.userPrompts[0], title: '已更新' }, 200);
    expect(updated.userPrompts[0]).toMatchObject({ title: '已更新', createdAt: 100, updatedAt: 200 });
  });

  it('stores builtin edits as overrides and builtin deletion as hidden state', () => {
    const state = createDefaultState();
    const edited = savePrompt(state, { ...resolvePrompts(state)[0], title: '自定义翻译' }, 10);
    expect(edited.userPrompts).toEqual([]);
    expect(edited.builtinOverrides.builtin_translate.title).toBe('自定义翻译');

    const deleted = deletePrompt(edited, 'builtin_translate');
    expect(deleted.hiddenBuiltinIds).toEqual(['builtin_translate']);
  });

  it('deletes user prompts and moves folder contents to uncategorized', () => {
    let state = createDefaultState();
    state = savePrompt(state, {
      title: '个人模板', content: '内容', folderId: 'folder_office', tags: [], source: 'user',
    }, 100, 'user-1');
    const withoutFolder = deleteFolder(state, 'folder_office', 200);
    expect(withoutFolder.userPrompts[0].folderId).toBe('');
    expect(withoutFolder.builtinOverrides.builtin_translate.folderId).toBe('');
    expect(deletePrompt(withoutFolder, 'user-1').userPrompts).toEqual([]);
  });

  it('forgets favorites, usage and remembered variables of a deleted prompt', () => {
    let state = createDefaultState();
    state = savePrompt(state, { title: '模板', content: '{{主题}}', folderId: '', tags: [], source: 'user' }, 100, 'user-1');
    state = recordPromptUse(state, 'user-1', 500);
    state = rememberVariableValues(state, 'user-1', { 主题: 'AI' });
    state.favoriteIds = ['user-1'];

    const deleted = deletePrompt(state, 'user-1');
    expect(deleted.usage).toEqual({});
    expect(deleted.variableValues).toEqual({});
    expect(deleted.favoriteIds).toEqual([]);
  });
});

describe('usage counting', () => {
  it('increments the counter and moves the timestamp forward', () => {
    const first = recordPromptUse(createDefaultState(), 'builtin_translate', 100);
    const second = recordPromptUse(first, 'builtin_translate', 400);
    expect(second.usage.builtin_translate).toEqual({ count: 2, lastUsedAt: 400 });
  });

  it('ranks a frequently used prompt above a merely recent one', () => {
    const base = { folderId: '', tags: [], content: '内容', source: 'user' as const, createdAt: 1, updatedAt: 1 };
    const prompts = [
      { ...base, id: 'recent', title: 'Alpha 一' },
      { ...base, id: 'frequent', title: 'Alpha 二' },
    ];
    expect(rankPrompts(prompts, 'Alpha', {
      usage: { recent: { count: 1, lastUsedAt: 900 }, frequent: { count: 7, lastUsedAt: 100 } },
    }).map(prompt => prompt.id)).toEqual(['frequent', 'recent']);
  });
});

describe('duplicate and bulk edits', () => {
  it('copies a builtin into a personal prompt with a free title', () => {
    const state = createDefaultState();
    const source = resolvePrompts(state)[0];
    const once = duplicatePrompt(state, source, 100, 'copy-1');
    const twice = duplicatePrompt(once, source, 200, 'copy-2');

    expect(once.userPrompts[0]).toMatchObject({ title: `${source.title} 副本`, source: 'user', content: source.content });
    expect(twice.userPrompts[1].title).toBe(`${source.title} 副本 2`);
    expect(twice.builtinOverrides).toEqual({});
  });

  it('moves and tags a mixed selection, hiding builtins on bulk delete', () => {
    let state = createDefaultState();
    state = savePrompt(state, { title: '个人', content: '内容', folderId: '', tags: ['旧'], source: 'user' }, 100, 'user-1');
    const ids = ['user-1', 'builtin_translate'];

    const moved = movePromptsToFolder(state, ids, 'folder_office', 300);
    expect(moved.userPrompts[0].folderId).toBe('folder_office');
    expect(moved.builtinOverrides.builtin_translate.folderId).toBe('folder_office');

    const tagged = addTagsToPrompts(moved, ids, ['新'], 400);
    expect(tagged.userPrompts[0].tags).toEqual(['旧', '新']);
    expect(tagged.builtinOverrides.builtin_translate.tags).toContain('新');

    const removed = deletePrompts(tagged, ids);
    expect(removed.userPrompts).toEqual([]);
    expect(removed.hiddenBuiltinIds).toEqual(['builtin_translate']);
  });
});
