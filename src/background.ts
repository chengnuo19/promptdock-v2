import { batchNotionBlocks, bookmarkToNotionBlocks, notionIdFromUrl } from './notion';
import { loadAnswerBookmarks, loadNotionConfig, loadNotionSecret, saveAnswerBookmarks, saveNotionConfig, saveNotionSecret } from './storage';
import type { AnswerBookmark, NotionDirectory } from './types';

const API_VERSION = '2026-03-11';
const endpoint = (path: string) => `https://api.notion.com/v1${path}`;

const notionRequest = async (path: string, init: RequestInit = {}) => {
  const token = await loadNotionSecret();
  if (!token) throw new Error('请先保存 Notion 内部集成令牌。');
  const response = await fetch(endpoint(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': API_VERSION, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const retryAfter = response.headers.get('Retry-After');
    const message = await response.text();
    throw new Error(`${response.status}${retryAfter ? ` (Retry-After ${retryAfter}s)` : ''}: ${message.slice(0, 240)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
};

const titleProperty = (properties: unknown) => Object.entries(properties as Record<string, { type?: string }>)
  .find(([, property]) => property.type === 'title')?.[0] ?? null;

const validateDirectory = async (name: string, databaseUrl: string): Promise<NotionDirectory> => {
  const linkedId = notionIdFromUrl(databaseUrl);
  if (!linkedId) throw new Error('无法从 Notion 数据库链接识别 ID。');
  let dataSourceId = linkedId;
  let dataSource: Record<string, unknown>;
  try {
    dataSource = await notionRequest(`/data_sources/${linkedId}`);
  } catch {
    const database = await notionRequest(`/databases/${linkedId}`);
    const first = Array.isArray(database.data_sources) ? database.data_sources[0] as { id?: unknown } : undefined;
    if (!first?.id || typeof first.id !== 'string') throw new Error('数据库未返回可用的 data source。');
    dataSourceId = first.id;
    dataSource = await notionRequest(`/data_sources/${dataSourceId}`);
  }
  const title = titleProperty(dataSource.properties);
  if (!title) throw new Error('目标数据源没有标题字段。');
  return { id: crypto.randomUUID(), name: name.trim(), databaseUrl, dataSourceId, titleProperty: title };
};

const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const appendBlocks = async (pageId: string, bookmark: AnswerBookmark) => {
  for (const children of batchNotionBlocks(bookmarkToNotionBlocks(bookmark))) {
    let attempt = 0;
    while (true) {
      try {
        await notionRequest(`/blocks/${pageId}/children`, { method: 'PATCH', body: JSON.stringify({ children }) });
        await pause(350);
        break;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const retry = /429/.test(detail) && attempt < 2;
        if (!retry) throw error;
        const seconds = Number(/Retry-After (\d+)/.exec(detail)?.[1] ?? 1);
        attempt += 1;
        await pause(seconds * 1000);
      }
    }
  }
};

const syncConversation = async (conversationId: string, directoryId: string, recreate = false) => {
  const [state, config] = await Promise.all([loadAnswerBookmarks(), loadNotionConfig()]);
  const conversation = state.conversations[conversationId];
  const directory = config.directories.find(item => item.id === directoryId);
  if (!conversation || !directory) throw new Error('找不到对话或 Notion 目录。');
  if (conversation.notionDirectoryId && conversation.notionDirectoryId !== directoryId) throw new Error('该对话已经固定到其他目录。');
  const pending = state.bookmarks.filter(item => item.conversationId === conversationId && !item.hidden && item.status !== 'synced');
  let pageId = recreate ? undefined : conversation.notionPageId;
  if (!pageId) {
    const page = await notionRequest('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: directory.dataSourceId }, properties: { [directory.titleProperty]: { title: [{ text: { content: conversation.title } }] } } }),
    });
    pageId = String(page.id);
    state.conversations[conversationId] = { ...conversation, notionDirectoryId: directoryId, notionPageId: pageId };
    await saveAnswerBookmarks(state);
  }
  for (const bookmark of pending) {
    try {
      await appendBlocks(pageId, bookmark);
      const current = state.bookmarks.find(item => item.id === bookmark.id);
      if (current) Object.assign(current, { status: 'synced', syncedAt: Date.now(), lastError: undefined });
      await saveAnswerBookmarks(state);
    } catch (error) {
      const current = state.bookmarks.find(item => item.id === bookmark.id);
      if (current) Object.assign(current, { status: /network|fetch/i.test(String(error)) ? 'check_required' : 'failed', lastError: error instanceof Error ? error.message : String(error) });
      await saveAnswerBookmarks(state);
      throw error;
    }
  }
  return { synced: pending.length, pageId };
};

chrome.runtime.onMessage.addListener((message: { type?: string; [key: string]: unknown }, _sender, sendResponse) => {
  const handle = async () => {
    if (message.type === 'notion:save-secret') return saveNotionSecret(String(message.token ?? ''));
    if (message.type === 'notion:clear-secret') return saveNotionSecret('');
    if (message.type === 'notion:test') return notionRequest('/users/me');
    if (message.type === 'notion:validate-directory') {
      const directory = await validateDirectory(String(message.name ?? ''), String(message.databaseUrl ?? ''));
      const config = await loadNotionConfig();
      await saveNotionConfig({ directories: [...config.directories, directory] });
      return directory;
    }
    if (message.type === 'notion:sync') return syncConversation(String(message.conversationId), String(message.directoryId), Boolean(message.recreate));
    throw new Error('未知后台请求。');
  };
  void handle().then(value => sendResponse({ ok: true, value })).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});
