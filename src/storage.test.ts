// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultState } from './domain/state';
import { loadAnswerBookmarks, loadNotionConfig, loadNotionSecret, loadState, saveAnswerBookmarks, saveNotionConfig, saveNotionSecret, saveState, STORAGE_KEY, watchState } from './storage';

type StorageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;

describe('chrome local storage', () => {
  let values: Record<string, unknown>;
  let listeners: StorageListener[];

  beforeEach(() => {
    values = {};
    listeners = [];
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: (_keys: string[], callback: (result: Record<string, unknown>) => void) => callback(values),
          set: (next: Record<string, unknown>, callback: () => void) => {
            values = { ...values, ...next };
            callback();
          },
        },
        onChanged: {
          addListener: (listener: StorageListener) => listeners.push(listener),
          removeListener: (listener: StorageListener) => {
            listeners = listeners.filter(item => item !== listener);
          },
        },
      },
    });
  });

  it('starts with a fresh V2 state and persists changes locally', async () => {
    const initial = await loadState();
    expect(initial.schemaVersion).toBe(2);
    expect(initial.userPrompts).toEqual([]);

    initial.favoriteIds = ['builtin_translate'];
    await saveState(initial);
    expect(values[STORAGE_KEY]).toBeDefined();
    expect((await loadState()).favoriteIds).toEqual(['builtin_translate']);
  });

  it('ignores unrelated or invalid old data', async () => {
    values[STORAGE_KEY] = { schemaVersion: 1, userPrompts: [{ id: 'old' }] };
    expect(await loadState()).toEqual(createDefaultState());
  });

  it('stores answer and Notion data outside the prompt backup state', async () => {
    await saveAnswerBookmarks({ bookmarks: [], conversations: {} });
    await saveNotionConfig({ directories: [] });
    await saveNotionSecret('secret-token');
    expect(await loadAnswerBookmarks()).toEqual({ bookmarks: [], conversations: {} });
    expect(await loadNotionConfig()).toEqual({ directories: [] });
    expect(await loadNotionSecret()).toBe('secret-token');
    expect(values[STORAGE_KEY]).toBeUndefined();
  });

  it('reports a state write from another tab and stops after unsubscribing', () => {
    const seen: string[][] = [];
    const stop = watchState(state => seen.push(state.favoriteIds));
    const external = { ...createDefaultState(), favoriteIds: ['builtin_translate'] };

    listeners.forEach(listener => listener({ [STORAGE_KEY]: { newValue: external } }, 'local'));
    expect(seen).toEqual([['builtin_translate']]);

    // Sync data unrelated to this key, or in another area, must not fire.
    listeners.forEach(listener => listener({ other_key: { newValue: 1 } }, 'local'));
    listeners.forEach(listener => listener({ [STORAGE_KEY]: { newValue: external } }, 'sync'));
    expect(seen).toHaveLength(1);

    stop();
    listeners.forEach(listener => listener({ [STORAGE_KEY]: { newValue: external } }, 'local'));
    expect(seen).toHaveLength(1);
  });

  it('ignores an external write that is not a valid V2 state', () => {
    const seen: unknown[] = [];
    watchState(state => seen.push(state));
    listeners.forEach(listener => listener({ [STORAGE_KEY]: { newValue: { schemaVersion: 1 } } }, 'local'));
    expect(seen).toEqual([]);
  });
});
