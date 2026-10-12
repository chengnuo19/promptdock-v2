import {
  Folder,
  Images,
  BookMarked,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Star,
  Tags,
  TextQuote,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  deletePrompt,
  rankPrompts,
  recordPromptUse,
  rememberVariableValues,
  resolvePrompts,
  restoreAllBuiltins,
  restoreBuiltin,
  savePrompt,
  toggleFavorite,
} from './domain/promptLogic';
import { DEFAULT_DRAWER_WIDTH, MAX_DRAWER_WIDTH, MIN_DRAWER_WIDTH, normalizeState } from './domain/state';
import { useAnchorPosition } from './hooks/useAnchorPosition';
import { usePageTheme } from './hooks/usePageTheme';
import { loadState, saveState, watchState } from './storage';
import type { InsertMode, PromptDockStateV2, PromptTemplate, SiteAdapter } from './types';
import { PhotoBatchPanel } from './features/photoBatch/PhotoBatchPanel';
import { FolderPanel } from './ui/FolderPanel';
import { PromptEditor } from './ui/PromptEditor';
import { PromptLibraryPanel } from './ui/PromptLibraryPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { TagPanel } from './ui/TagPanel';
import { AnswerBookmarksPanel } from './ui/AnswerBookmarksPanel';
import { InlineCommandMenu } from './ui/InlineCommandMenu';
import { QuickPromptPanel } from './ui/QuickPromptPanel';

type View = 'quick' | 'prompts' | 'folders' | 'tags' | 'favorites' | 'answers' | 'photo' | 'settings';
type PendingInsert = { text: string; promptId: string; variableValues: Record<string, string> };

const NAV_ITEMS: Array<{ view: View; label: string; icon: typeof TextQuote }> = [
  { view: 'prompts', label: '提示词', icon: TextQuote },
  { view: 'folders', label: '文件夹', icon: Folder },
  { view: 'tags', label: '标签', icon: Tags },
  { view: 'favorites', label: '收藏', icon: Star },
  { view: 'answers', label: '回答收藏', icon: BookMarked },
  { view: 'photo', label: '图片分批', icon: Images },
  { view: 'settings', label: '设置', icon: Settings },
];

const clampDrawerWidth = (width: number) => Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, width));

export const PromptDockApp = ({ adapter, composer }: { adapter: SiteAdapter; composer: HTMLElement }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<PromptDockStateV2 | null>(null);
  const [view, setView] = useState<View>('quick');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [folderFilter, setFolderFilter] = useState<{ id: string; name: string } | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [pendingInsert, setPendingInsert] = useState<PendingInsert | null>(null);
  const [status, setStatus] = useState('');
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Serialized form of our own last write, so the storage watcher can tell an
  // external tab's change apart from the echo of our own.
  const lastWrittenRef = useRef('');
  const anchorPosition = useAnchorPosition(adapter, composer);
  const theme = usePageTheme();
  const drawerStyle = {
    width: drawerWidth,
    '--pd-composer-top': `${anchorPosition.anchorTop}px`,
  } as CSSProperties;

  useEffect(() => {
    loadState()
      .then(next => {
        setState(next);
        setDrawerWidth(next.settings.drawerWidth);
      })
      .catch(error => setStatus(`读取本机数据失败：${error instanceof Error ? error.message : '未知错误'}`));

    return watchState(external => {
      if (JSON.stringify(external) === lastWrittenRef.current) return;
      setState(external);
      setDrawerWidth(external.settings.drawerWidth);
      setStatus('已同步其他标签页的改动。');
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pendingInsert) setPendingInsert(null);
        else if (editing) setEditing(null);
        else setIsOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editing, isOpen, pendingInsert]);

  const persist = (next: PromptDockStateV2, message = '') => {
    const normalized = normalizeState(next);
    lastWrittenRef.current = JSON.stringify(normalized);
    setState(normalized);
    if (message) setStatus(message);
    void saveState(normalized).catch(error => {
      setStatus(`保存失败，当前更改尚未可靠写入：${error instanceof Error ? error.message : '未知错误'}`);
    });
  };

  const allPrompts = useMemo(() => state ? resolvePrompts(state) : [], [state]);
  const visiblePrompts = useMemo(() => {
    if (!state) return [];
    let prompts = allPrompts;
    if (view === 'favorites') prompts = prompts.filter(prompt => state.favoriteIds.includes(prompt.id));
    if (folderFilter) prompts = prompts.filter(prompt => prompt.folderId === folderFilter.id);
    if (tagFilter) prompts = prompts.filter(prompt => prompt.tags.includes(tagFilter));
    return rankPrompts(prompts, search, { favoriteIds: state.favoriteIds, usage: state.usage });
  }, [allPrompts, folderFilter, search, state, tagFilter, view]);

  const updateView = (nextView: View) => {
    setView(nextView);
    if (nextView !== 'prompts') {
      setFolderFilter(null);
      setTagFilter('');
    }
    setEditing(null);
    setPendingInsert(null);
  };

  const startNew = () => setEditing({
    id: crypto.randomUUID(),
    title: '',
    content: '',
    folderId: folderFilter?.id ?? '',
    tags: tagFilter ? [tagFilter] : [],
    source: 'user',
    createdAt: 0,
    updatedAt: 0,
  });

  const saveEditedPrompt = (prompt: PromptTemplate) => {
    if (!state) return;
    persist(savePrompt(state, prompt), '提示词已保存。');
    setSelectedId(prompt.id);
    setEditing(null);
  };

  const removePrompt = (prompt: PromptTemplate) => {
    if (!state || !window.confirm(`${prompt.source === 'builtin' ? '隐藏内置提示词' : '删除提示词'}“${prompt.title}”？`)) return;
    persist(deletePrompt(state, prompt.id), prompt.source === 'builtin' ? '内置提示词已隐藏，可在设置中恢复。' : '提示词已删除。');
    setSelectedId('');
  };

  const performInsert = (pending: PendingInsert, mode: InsertMode) => {
    if (!state) return;
    const currentComposer = adapter.findComposer() ?? composer;
    const result = adapter.writeText(pending.text, mode, currentComposer);
    if (!result.ok) {
      setStatus('写入输入框失败，请刷新网页后重试。');
      return;
    }
    const used = recordPromptUse(state, pending.promptId);
    persist(rememberVariableValues(used, pending.promptId, pending.variableValues), '已插入输入框，请检查后手动发送。');
    setPendingInsert(null);
    setIsOpen(false);
    adapter.focusComposer(currentComposer);
  };

  const requestInsert = (text: string, promptId: string, variableValues: Record<string, string> = {}) => {
    const currentComposer = adapter.findComposer() ?? composer;
    const pending = { text, promptId, variableValues };
    if (adapter.readText(currentComposer).trim()) setPendingInsert(pending);
    else performInsert(pending, 'replace');
  };

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = drawerWidth;
    let latestWidth = startWidth;
    const onMove = (moveEvent: PointerEvent) => {
      latestWidth = clampDrawerWidth(startWidth + startX - moveEvent.clientX);
      setDrawerWidth(latestWidth);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setState(current => {
        if (!current) return current;
        const next = normalizeState({ ...current, settings: { ...current.settings, drawerWidth: latestWidth } });
        lastWrittenRef.current = JSON.stringify(next);
        void saveState(next).catch(() => setStatus('抽屉宽度保存失败。'));
        return next;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const filterLabel = folderFilter ? `文件夹：${folderFilter.name}` : tagFilter ? `标签：${tagFilter}` : view === 'favorites' ? '仅显示收藏' : undefined;

  return (
    <div className="pd-app" data-theme={theme}>
      <button
        className="pd-launcher"
        type="button"
        style={{ left: anchorPosition.left, top: anchorPosition.top }}
        onClick={() => {
          if (isOpen) setIsOpen(false);
          else { setView('quick'); setSearch(''); setEditing(null); setPendingInsert(null); setIsOpen(true); }
        }}
        aria-label={isOpen ? '关闭 PromptDock' : '打开 PromptDock'}
        title="PromptDock"
      >
        {isOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
      </button>

      {isOpen && (
        <aside className="pd-drawer" style={drawerStyle} aria-label="PromptDock 提示词工作台">
          <div className="pd-resize-handle" role="separator" aria-orientation="vertical" aria-label="调整抽屉宽度" onPointerDown={beginResize} />
          <nav className="pd-nav" aria-label="PromptDock 导航">
            <div className="pd-brand" aria-label="PromptDock">PD</div>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button className={view === item.view ? 'is-active' : ''} type="button" key={item.view} onClick={() => updateView(item.view)} title={item.label} aria-label={item.label}>
                  <Icon size={18} /><span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pd-main">
            <header className="pd-drawer-header">
              <div><strong>PromptDock</strong><span>{adapter.name === 'chatgpt' ? 'ChatGPT' : 'Gemini'}</span></div>
              <button ref={closeRef} className="pd-icon-button" type="button" onClick={() => setIsOpen(false)} aria-label="关闭 PromptDock"><X size={18} /></button>
            </header>

            <div className="pd-scroll-area">
              {!state && <div className="pd-loading" aria-busy="true">正在读取本机提示词…</div>}
              {state && editing && <PromptEditor key={editing.id} prompt={editing} folders={state.folders} onSave={saveEditedPrompt} onCancel={() => setEditing(null)} />}
              {state && !editing && view === 'quick' && <QuickPromptPanel state={state} prompts={allPrompts} onInsert={requestInsert} onManage={() => updateView('prompts')} />}
              {state && !editing && (view === 'prompts' || view === 'favorites') && (
                <PromptLibraryPanel
                  state={state}
                  prompts={visiblePrompts}
                  folders={state.folders}
                  selectedId={selectedId}
                  filterLabel={filterLabel}
                  onSelect={setSelectedId}
                  onSearch={setSearch}
                  onNew={startNew}
                  onEdit={setEditing}
                  onDelete={removePrompt}
                  onReset={id => persist(restoreBuiltin(state, id), '内置提示词已恢复。')}
                  onFavorite={id => persist(toggleFavorite(state, id))}
                  onInsert={requestInsert}
                  onChange={persist}
                  onClearFilter={folderFilter || tagFilter ? () => { setFolderFilter(null); setTagFilter(''); } : undefined}
                />
              )}
              {state && !editing && view === 'folders' && (
                <FolderPanel state={state} prompts={allPrompts} onChange={persist} onOpen={(id, name) => { setFolderFilter({ id, name }); setTagFilter(''); setView('prompts'); }} />
              )}
              {state && !editing && view === 'tags' && (
                <TagPanel prompts={allPrompts} onOpen={tag => { setTagFilter(tag); setFolderFilter(null); setView('prompts'); }} />
              )}
              {state && !editing && view === 'answers' && <AnswerBookmarksPanel site={adapter.name} />}
              {state && !editing && view === 'photo' && <PhotoBatchPanel adapter={adapter} />}
              {state && !editing && view === 'settings' && (
                <SettingsPanel
                  state={state}
                  onChange={persist}
                  onRestoreBuiltin={id => persist(restoreBuiltin(state, id), '内置提示词已恢复。')}
                  onRestoreBuiltins={() => {
                    if (window.confirm('恢复全部内置提示词？个人提示词不会受到影响。')) persist(restoreAllBuiltins(state), '全部内置提示词已恢复。');
                  }}
                />
              )}
            </div>

            {status && <div className={status.includes('失败') ? 'pd-global-status is-error' : 'pd-global-status'} role="status">{status}</div>}
          </div>

          {pendingInsert && (
            <div className="pd-confirm-backdrop" role="presentation">
              <section className="pd-confirm" role="dialog" aria-modal="true" aria-labelledby="insert-confirm-title">
                <h2 id="insert-confirm-title">输入框中已有内容</h2>
                <p>请选择保留原草稿并追加，或用新提示词替换。</p>
                <div className="pd-action-row">
                  <button className="pd-button pd-button-primary" type="button" onClick={() => performInsert(pendingInsert, 'append')}>追加</button>
                  <button className="pd-button pd-button-secondary" type="button" onClick={() => performInsert(pendingInsert, 'replace')}>替换</button>
                  <button className="pd-button pd-button-quiet" type="button" onClick={() => setPendingInsert(null)}>取消</button>
                </div>
              </section>
            </div>
          )}
        </aside>
      )}
      {state && <InlineCommandMenu adapter={adapter} composer={composer} prompts={allPrompts} state={state} onUsed={(id, variableValues) => persist(rememberVariableValues(recordPromptUse(state, id), id, variableValues))} />}
    </div>
  );
};
