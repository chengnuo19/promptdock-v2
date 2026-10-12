import { Download, ExternalLink, RefreshCw, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { bookmarksForConversation, removeBookmark, searchBookmarks, visibleBookmarks } from '../domain/answerBookmarks';
import { bookmarksToMarkdown } from '../domain/answerExport';
import { getConversationAdapter } from '../conversationAdapters';
import { loadAnswerBookmarks, loadNotionConfig, saveAnswerBookmarks, watchAnswerBookmarks } from '../storage';
import type { AnswerBookmarksState, NotionConfig, SiteName } from '../types';

type Scope = 'current' | 'all';

const send = <T,>(message: Record<string, unknown>) => new Promise<T>((resolve, reject) => {
  if (!chrome.runtime?.sendMessage) return reject(new Error('后台 service worker 不可用。'));
  chrome.runtime.sendMessage(message, (response: { ok?: boolean; value?: T; error?: string } | undefined) => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else if (!response?.ok) reject(new Error(response?.error || 'Notion 请求失败。'));
    else resolve(response.value as T);
  });
});

const statusLabel: Record<string, string> = {
  local: '本地待同步',
  syncing: '正在同步',
  synced: '已同步',
  failed: '同步失败',
  check_required: '需要检查远端状态',
};

export const AnswerBookmarksPanel = ({ site }: { site: SiteName }) => {
  const adapter = useMemo(() => getConversationAdapter(site), [site]);
  const conversation = adapter.getConversation();
  const [state, setState] = useState<AnswerBookmarksState | null>(null);
  const [config, setConfig] = useState<NotionConfig>({ directories: [] });
  const [directoryId, setDirectoryId] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<Scope>('current');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const conversationId = conversation.id;
  const refresh = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadAnswerBookmarks(), loadNotionConfig()]).then(([bookmarks, notion]) => {
      if (cancelled) return;
      setState(bookmarks);
      setConfig(notion);
      setDirectoryId(bookmarks.conversations[conversationId]?.notionDirectoryId ?? notion.directories[0]?.id ?? '');
    });
    return () => { cancelled = true; };
  }, [conversationId, reloadKey]);

  // Stars added on the page itself, or a sync finishing in the background, both
  // land in storage rather than in this component's state.
  useEffect(() => watchAnswerBookmarks(setState), []);

  const bookmarks = useMemo(() => {
    if (!state) return [];
    const scoped = scope === 'current'
      ? bookmarksForConversation(state, conversationId)
      : visibleBookmarks(state);
    return searchBookmarks(scoped, query);
  }, [conversationId, query, scope, state]);
  const pendingHere = state ? bookmarksForConversation(state, conversationId).length : 0;

  const remove = async (id: string) => {
    if (!state) return;
    const next = removeBookmark(state, id);
    setState(next);
    await saveAnswerBookmarks(next);
  };

  const jump = (locator: string, bookmarkConversationId: string, sourceUrl: string) => {
    if (bookmarkConversationId !== conversationId) {
      window.open(sourceUrl, '_blank', 'noopener');
      return;
    }
    // focus() reports whether the message is actually on the page right now.
    if (!adapter.focus(locator)) {
      setStatus('没有在当前页面找到这条回答，可能需要向上滚动加载更早的消息。');
    }
  };

  const exportMarkdown = () => {
    if (!bookmarks.length) return;
    const blob = new Blob([bookmarksToMarkdown(bookmarks, state?.conversations)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `promptdock-answers-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`已导出 ${bookmarks.length} 条回答收藏。`);
  };

  const sync = async () => {
    if (!directoryId) return setStatus('请先在设置中添加并验证 Notion 目录。');
    setStatus('正在同步…');
    try {
      const result = await send<{ synced: number }>({ type: 'notion:sync', conversationId, directoryId });
      setStatus(`已同步 ${result.synced} 条回答收藏。`);
      refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '同步失败。');
      refresh();
    }
  };

  return <section className="pd-section" aria-labelledby="answer-bookmarks-title">
    <div className="pd-section-header">
      <div><h2 id="answer-bookmarks-title">回答收藏</h2><p>{scope === 'current' ? conversation.title : '全部对话'}</p></div>
      <div className="pd-inline-actions">
        <button className="pd-icon-button" type="button" onClick={exportMarkdown} disabled={!bookmarks.length} aria-label="导出为 Markdown"><Download size={16} /></button>
        <button className="pd-icon-button" type="button" onClick={refresh} aria-label="刷新回答收藏"><RefreshCw size={16} /></button>
      </div>
    </div>

    <div className="pd-scope-switch" role="group" aria-label="收藏范围">
      <button className={scope === 'current' ? 'is-active' : ''} type="button" aria-pressed={scope === 'current'} onClick={() => setScope('current')}>当前对话</button>
      <button className={scope === 'all' ? 'is-active' : ''} type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>全部对话</button>
    </div>

    <label className="pd-search">
      <Search size={16} />
      <input value={query} aria-label="搜索回答收藏" placeholder="搜索对话标题、问题或回答" onChange={event => setQuery(event.target.value)} />
    </label>

    <label className="pd-field"><span>Notion 目录</span><select value={directoryId} onChange={event => setDirectoryId(event.target.value)}><option value="">选择目录</option>{config.directories.map(directory => <option value={directory.id} key={directory.id}>{directory.name}</option>)}</select></label>
    <button className="pd-button pd-button-primary pd-full" type="button" disabled={!pendingHere || !directoryId} onClick={() => void sync()}>同步当前对话</button>
    {status && <p className="pd-status">{status}</p>}

    {!bookmarks.length && (
      <div className="pd-empty">
        <Star size={20} />
        <strong>{query ? '没有匹配的回答收藏' : '尚未收藏回答'}</strong>
        <span>{query ? '换个关键词，或切换到全部对话。' : '在网页回答操作栏点星标，即可保存当前问答快照。'}</span>
      </div>
    )}

    <div className="pd-manage-list">{bookmarks.map(bookmark => {
      const isHere = bookmark.conversationId === conversationId;
      return (
        <article className="pd-info-card" key={bookmark.id}>
          {scope === 'all' && <small className="pd-eyebrow">{bookmark.conversationTitle || '未命名对话'}</small>}
          <strong>{bookmark.snapshot.questionText || '未找到对应问题'}</strong>
          <span>{bookmark.snapshot.answerText.slice(0, 120) || '回答内容为空'}</span>
          <small className="pd-status">{statusLabel[bookmark.status] ?? bookmark.status}</small>
          <div className="pd-action-row">
            <button className="pd-button pd-button-quiet" type="button" onClick={() => jump(bookmark.locator, bookmark.conversationId, bookmark.snapshot.sourceUrl)}>
              <ExternalLink size={15} /> {isHere ? '跳转' : '打开对话'}
            </button>
            <button className="pd-icon-button pd-danger-action" type="button" aria-label={`取消收藏 ${bookmark.snapshot.questionText || bookmark.id}`} onClick={() => void remove(bookmark.id)}><Trash2 size={16} /></button>
          </div>
        </article>
      );
    })}</div>
  </section>;
};
