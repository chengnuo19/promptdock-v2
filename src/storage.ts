import type { AnswerBookmarksState, NotionConfig, PromptDockStateV2 } from './types';
import { createAnswerBookmarksState } from './domain/answerBookmarks';
import { createDefaultState, isPromptDockState, normalizeState } from './domain/state';

export const STORAGE_KEY = 'promptdock_state_v2';
export const ANSWER_BOOKMARKS_KEY = 'promptdock_answer_bookmarks_v1';
export const NOTION_CONFIG_KEY = 'promptdock_notion_config_v1';
export const NOTION_SECRET_KEY = 'promptdock_notion_secret_v1';

const localArea = (): chrome.storage.StorageArea | null => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  return chrome.storage.local;
};

export const loadState = async (): Promise<PromptDockStateV2> => {
  const area = localArea();
  if (!area) return createDefaultState();

  return new Promise((resolve, reject) => {
    area.get([STORAGE_KEY], result => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      const value = result[STORAGE_KEY];
      resolve(isPromptDockState(value) ? normalizeState(value) : createDefaultState());
    });
  });
};

export const saveState = async (state: PromptDockStateV2): Promise<void> => {
  const area = localArea();
  if (!area) return;
  const normalized = normalizeState(state);

  return new Promise((resolve, reject) => {
    area.set({ [STORAGE_KEY]: normalized }, () => {
      const error = chrome.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
};

const loadValue = <T>(key: string, fallback: T): Promise<T> => {
  const area = localArea();
  if (!area) return Promise.resolve(fallback);
  return new Promise((resolve, reject) => area.get([key], result => {
    const error = chrome.runtime?.lastError;
    if (error) reject(new Error(error.message));
    else resolve((result[key] as T | undefined) ?? fallback);
  }));
};

const saveValue = (key: string, value: unknown): Promise<void> => {
  const area = localArea();
  if (!area) return Promise.resolve();
  return new Promise((resolve, reject) => area.set({ [key]: value }, () => {
    const error = chrome.runtime?.lastError;
    if (error) reject(new Error(error.message));
    else resolve();
  }));
};

/**
 * chrome.storage is shared by every open tab, and each tab writes the whole blob
 * back. Watching for external writes is what stops one tab from silently
 * discarding what another one just saved.
 */
const watchKey = <T>(key: string, onChange: (value: T) => void): (() => void) => {
  const area = localArea();
  const changed = chrome.storage?.onChanged;
  if (!area || !changed) return () => undefined;

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !(key in changes)) return;
    const value = changes[key].newValue as T | undefined;
    if (value !== undefined) onChange(value);
  };
  changed.addListener(listener);
  return () => changed.removeListener(listener);
};

export const watchState = (onChange: (state: PromptDockStateV2) => void) => watchKey<unknown>(
  STORAGE_KEY,
  value => { if (isPromptDockState(value)) onChange(normalizeState(value)); },
);

export const watchAnswerBookmarks = (onChange: (state: AnswerBookmarksState) => void) => watchKey<AnswerBookmarksState>(ANSWER_BOOKMARKS_KEY, onChange);

export const loadAnswerBookmarks = () => loadValue(ANSWER_BOOKMARKS_KEY, createAnswerBookmarksState());
export const saveAnswerBookmarks = (state: AnswerBookmarksState) => saveValue(ANSWER_BOOKMARKS_KEY, state);
export const loadNotionConfig = () => loadValue<NotionConfig>(NOTION_CONFIG_KEY, { directories: [] });
export const saveNotionConfig = (config: NotionConfig) => saveValue(NOTION_CONFIG_KEY, config);
export const loadNotionSecret = () => loadValue<string>(NOTION_SECRET_KEY, '');
export const saveNotionSecret = (token: string) => saveValue(NOTION_SECRET_KEY, token.trim());
