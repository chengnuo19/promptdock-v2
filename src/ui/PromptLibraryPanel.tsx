import { CheckSquare, Copy, Edit3, FolderInput, Plus, RotateCcw, Search, Star, Tag, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  addTagsToPrompts,
  deletePrompts,
  duplicatePrompt,
  extractVariables,
  fillPromptVariables,
  initialVariableValues,
  movePromptsToFolder,
  parseTags,
} from '../domain/promptLogic';
import type { PromptDockStateV2, PromptFolder, PromptTemplate } from '../types';

/** The select needs a non-empty value, but "no folder" is stored as an empty id. */
const UNCATEGORIZED = '__uncategorized';

type PromptLibraryPanelProps = {
  state: PromptDockStateV2;
  prompts: PromptTemplate[];
  folders: PromptFolder[];
  selectedId: string;
  filterLabel?: string;
  onSelect: (id: string) => void;
  onSearch: (value: string) => void;
  onNew: () => void;
  onEdit: (prompt: PromptTemplate) => void;
  onDelete: (prompt: PromptTemplate) => void;
  onReset: (id: string) => void;
  onFavorite: (id: string) => void;
  onInsert: (text: string, promptId: string, variableValues?: Record<string, string>) => void;
  onChange: (state: PromptDockStateV2, message: string) => void;
  onClearFilter?: () => void;
};

export const PromptLibraryPanel = ({
  state,
  prompts,
  folders,
  selectedId,
  filterLabel,
  onSelect,
  onSearch,
  onNew,
  onEdit,
  onDelete,
  onReset,
  onFavorite,
  onInsert,
  onChange,
  onClearFilter,
}: PromptLibraryPanelProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const selected = prompts.find(prompt => prompt.id === selectedId) ?? prompts[0] ?? null;
  const [variableState, setVariableState] = useState<{
    promptId: string;
    values: Record<string, string>;
    missing: string[];
  }>({ promptId: '', values: {}, missing: [] });
  const [bulkMode, setBulkMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState('');
  const prefilled = useMemo(
    () => selected ? initialVariableValues(selected.content, state.variableValues[selected.id]) : {},
    [selected, state.variableValues],
  );
  const values = variableState.promptId === selected?.id ? variableState.values : prefilled;
  const missing = variableState.promptId === selected?.id ? variableState.missing : [];
  const variables = useMemo(() => selected ? extractVariables(selected.content) : [], [selected]);
  const folderName = selected
    ? folders.find(folder => folder.id === selected.folderId)?.name ?? '未分类'
    : '';
  const usageCount = selected ? state.usage[selected.id]?.count ?? 0 : 0;
  // Only the prompts currently listed can be acted on, so a filter change never
  // leaves an invisible prompt selected.
  const checked = useMemo(
    () => checkedIds.filter(id => prompts.some(prompt => prompt.id === id)),
    [checkedIds, prompts],
  );

  const insert = () => {
    if (!selected) return;
    const result = fillPromptVariables(selected.content, values);
    if (!result.ok) {
      setVariableState({ promptId: selected.id, values, missing: result.missing });
      const firstIndex = variables.findIndex(variable => variable.name === result.missing[0]);
      requestAnimationFrame(() => containerRef.current
        ?.querySelector<HTMLTextAreaElement>(`[data-variable-index="${firstIndex}"]`)
        ?.focus());
      return;
    }
    setVariableState({ promptId: selected.id, values, missing: [] });
    onInsert(result.text, selected.id, values);
  };

  const toggleChecked = (id: string) => setCheckedIds(current => current.includes(id)
    ? current.filter(item => item !== id)
    : [...current, id]);

  const leaveBulkMode = () => {
    setBulkMode(false);
    setCheckedIds([]);
    setBulkTags('');
  };

  const duplicate = (prompt: PromptTemplate) => {
    onChange(duplicatePrompt(state, prompt), `已创建「${prompt.title}」的副本。`);
  };

  const bulkMove = (choice: string) => {
    const folderId = choice === UNCATEGORIZED ? '' : choice;
    const name = folders.find(folder => folder.id === folderId)?.name ?? '未分类';
    onChange(movePromptsToFolder(state, checked, folderId), `${checked.length} 条提示词已移到「${name}」。`);
    leaveBulkMode();
  };

  const bulkTag = () => {
    const tags = parseTags(bulkTags);
    if (!tags.length) return;
    onChange(addTagsToPrompts(state, checked, tags), `${checked.length} 条提示词已添加标签。`);
    leaveBulkMode();
  };

  const bulkDelete = () => {
    const builtins = checked.filter(id => prompts.find(prompt => prompt.id === id)?.source === 'builtin').length;
    const detail = builtins ? `，其中 ${builtins} 条内置提示词只会被隐藏，可在设置中恢复` : '';
    if (!window.confirm(`删除选中的 ${checked.length} 条提示词${detail}？`)) return;
    onChange(deletePrompts(state, checked), `已删除 ${checked.length} 条提示词。`);
    leaveBulkMode();
  };

  return (
    <section ref={containerRef} className="pd-library" aria-labelledby="prompt-library-title">
      <h2 id="prompt-library-title" className="pd-sr-only">提示词库</h2>
      <div className="pd-library-toolbar">
        <label className="pd-search">
          <Search size={16} />
          <input aria-label="搜索提示词" placeholder="搜索标题、正文或标签" onChange={event => onSearch(event.target.value)} />
        </label>
        <button
          className={bulkMode ? 'pd-icon-button is-active' : 'pd-icon-button'}
          type="button"
          onClick={() => bulkMode ? leaveBulkMode() : setBulkMode(true)}
          aria-pressed={bulkMode}
          aria-label={bulkMode ? '退出批量操作' : '批量操作'}
        >
          <CheckSquare size={18} />
        </button>
        <button className="pd-icon-button pd-icon-button-accent" type="button" onClick={onNew} aria-label="新建提示词">
          <Plus size={18} />
        </button>
      </div>

      {filterLabel && (
        <div className="pd-filter-banner">
          <span>{filterLabel}</span>
          {onClearFilter && <button type="button" onClick={onClearFilter}>清除</button>}
        </div>
      )}

      {bulkMode && (
        <div className="pd-bulk-bar" role="group" aria-label="批量操作">
          <div className="pd-bulk-summary">
            <strong>已选 {checked.length} 条</strong>
            <button type="button" onClick={() => setCheckedIds(checked.length === prompts.length ? [] : prompts.map(prompt => prompt.id))}>
              {checked.length === prompts.length && prompts.length > 0 ? '取消全选' : '全选当前列表'}
            </button>
          </div>
          <label className="pd-field">
            <span><FolderInput size={14} /> 移动到文件夹</span>
            <select value="" disabled={!checked.length} onChange={event => bulkMove(event.target.value)}>
              <option value="" disabled>选择目标文件夹</option>
              <option value={UNCATEGORIZED}>未分类</option>
              {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </label>
          <label className="pd-field">
            <span><Tag size={14} /> 添加标签</span>
            <div className="pd-create-row">
              <input value={bulkTags} placeholder="逗号或空格分隔" onChange={event => setBulkTags(event.target.value)} />
              <button className="pd-button pd-button-secondary" type="button" disabled={!checked.length || !bulkTags.trim()} onClick={bulkTag}>添加</button>
            </div>
          </label>
          <button className="pd-button pd-button-secondary pd-full pd-danger-action" type="button" disabled={!checked.length} onClick={bulkDelete}>
            <Trash2 size={15} /> 删除选中项
          </button>
        </div>
      )}

      <div className="pd-prompt-list" role="list" aria-label="提示词列表">
        {prompts.map(prompt => (
          <div className={`pd-prompt-row${bulkMode ? ' is-bulk' : prompt.id === selected?.id ? ' is-selected' : ''}`} role="listitem" key={prompt.id}>
            {bulkMode && (
              <label className="pd-prompt-check">
                <input
                  type="checkbox"
                  checked={checked.includes(prompt.id)}
                  onChange={() => toggleChecked(prompt.id)}
                  aria-label={`选择 ${prompt.title}`}
                />
              </label>
            )}
            <button className="pd-prompt-select" type="button" onClick={() => bulkMode ? toggleChecked(prompt.id) : onSelect(prompt.id)}>
              <strong>{prompt.title}</strong>
              <span>{folders.find(folder => folder.id === prompt.folderId)?.name ?? '未分类'} · {prompt.tags.slice(0, 2).join(' / ') || '无标签'}</span>
            </button>
            <button className="pd-row-action" type="button" onClick={() => onFavorite(prompt.id)} aria-label={state.favoriteIds.includes(prompt.id) ? `取消收藏 ${prompt.title}` : `收藏 ${prompt.title}`}>
              <Star size={15} fill={state.favoriteIds.includes(prompt.id) ? 'currentColor' : 'none'} />
            </button>
          </div>
        ))}
        {!prompts.length && (
          <div className="pd-empty" role="status">
            <strong>没有找到提示词</strong>
            <span>更换搜索词或清除当前筛选。</span>
          </div>
        )}
      </div>

      {selected && !bulkMode && (
        <article className="pd-prompt-detail" aria-labelledby="prompt-detail-title">
          <div className="pd-detail-heading">
            <div>
              <span className="pd-eyebrow">{folderName} · {selected.source === 'builtin' ? '内置' : '个人'} · {usageCount ? `已使用 ${usageCount} 次` : '尚未使用'}</span>
              <h2 id="prompt-detail-title">{selected.title}</h2>
            </div>
            <div className="pd-inline-actions">
              <button className="pd-icon-button" type="button" onClick={() => onEdit(selected)} aria-label="编辑提示词"><Edit3 size={16} /></button>
              <button className="pd-icon-button" type="button" onClick={() => duplicate(selected)} aria-label="创建副本"><Copy size={16} /></button>
              {selected.source === 'builtin' && state.builtinOverrides[selected.id] && (
                <button className="pd-icon-button" type="button" onClick={() => onReset(selected.id)} aria-label="恢复内置提示词"><RotateCcw size={16} /></button>
              )}
              <button className="pd-icon-button pd-danger-action" type="button" onClick={() => onDelete(selected)} aria-label="删除提示词"><Trash2 size={16} /></button>
            </div>
          </div>
          <pre className="pd-prompt-content">{selected.content}</pre>

          {variables.length > 0 && (
            <div className="pd-variable-fields">
              <h3>填写变量</h3>
              {variables.map((variable, index) => (
                <label className={missing.includes(variable.name) ? 'pd-field has-error' : 'pd-field'} key={variable.name}>
                  <span>{variable.name}{variable.defaultValue && <small className="pd-variable-default">默认：{variable.defaultValue}</small>}</span>
                  <textarea
                    data-variable-index={index}
                    rows={2}
                    placeholder={variable.defaultValue}
                    value={values[variable.name] ?? ''}
                    onChange={event => setVariableState({
                      promptId: selected.id,
                      values: { ...values, [variable.name]: event.target.value },
                      missing: missing.filter(name => name !== variable.name),
                    })}
                    aria-invalid={missing.includes(variable.name)}
                  />
                  {missing.includes(variable.name) && <small>请填写此变量</small>}
                </label>
              ))}
            </div>
          )}

          <button className="pd-button pd-button-primary pd-full" type="button" onClick={insert}>插入输入框</button>
        </article>
      )}
    </section>
  );
};
