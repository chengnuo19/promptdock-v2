import { Search, Settings2, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { extractVariables, fillPromptVariables, initialVariableValues, rankPrompts } from '../domain/promptLogic';
import type { PromptDockStateV2, PromptTemplate } from '../types';

export const QuickPromptPanel = ({ state, prompts, onInsert, onManage }: {
  state: PromptDockStateV2;
  prompts: PromptTemplate[];
  onInsert: (text: string, promptId: string, variableValues?: Record<string, string>) => void;
  onManage: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const ranked = useMemo(() => rankPrompts(prompts, query, { favoriteIds: state.favoriteIds, usage: state.usage }), [prompts, query, state.favoriteIds, state.usage]);
  const favorites = useMemo(() => ranked.filter(prompt => state.favoriteIds.includes(prompt.id)).slice(0, 5), [ranked, state.favoriteIds]);
  const recent = useMemo(() => ranked.filter(prompt => !favorites.some(item => item.id === prompt.id) && state.usage[prompt.id]).slice(0, 5), [favorites, ranked, state.usage]);
  const results = query ? ranked : [...favorites, ...recent];
  const variables = selected ? extractVariables(selected.content) : [];

  useEffect(() => { inputRef.current?.focus(); }, []);

  const choose = (prompt: PromptTemplate) => {
    if (extractVariables(prompt.content).length) {
      setSelected(prompt);
      setValues(initialVariableValues(prompt.content, state.variableValues[prompt.id]));
      setMissing([]);
      requestAnimationFrame(() => fieldsRef.current?.querySelector('textarea')?.focus());
    } else onInsert(prompt.content, prompt.id);
  };
  const submit = () => {
    if (!selected) return;
    const result = fillPromptVariables(selected.content, values);
    if (!result.ok) {
      setMissing(result.missing);
      requestAnimationFrame(() => fieldsRef.current?.querySelector<HTMLTextAreaElement>(`[data-variable="${result.missing[0]}"]`)?.focus());
      return;
    }
    onInsert(result.text, selected.id, values);
  };

  if (selected) return <section className="pd-section" ref={fieldsRef} aria-label="填写提示词变量">
    <div className="pd-section-header"><div><h2>{selected.title}</h2><p>填写变量后插入，内容不会自动发送。</p></div><button className="pd-button pd-button-quiet" type="button" onClick={() => setSelected(null)}>返回</button></div>
    {variables.map(({ name, defaultValue }) => <label className={missing.includes(name) ? 'pd-field has-error' : 'pd-field'} key={name}><span>{name}{defaultValue && <small className="pd-variable-default">默认：{defaultValue}</small>}</span><textarea data-variable={name} rows={2} placeholder={defaultValue} value={values[name] ?? ''} onChange={event => { setValues({ ...values, [name]: event.target.value }); setMissing(missing.filter(item => item !== name)); }} />{missing.includes(name) && <small>请填写此变量</small>}</label>)}
    <button className="pd-button pd-button-primary" type="button" onClick={submit}>插入输入框</button>
  </section>;

  return <section className="pd-quick" aria-labelledby="quick-title" onKeyDown={event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(value => Math.max(0, Math.min(results.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1)))); }
    if (event.key === 'Enter' && results[active]) { event.preventDefault(); choose(results[active]); }
  }}>
    <div className="pd-section-header"><div><h2 id="quick-title">快速查找</h2><p>搜索并插入，不会自动发送。</p></div><button className="pd-button pd-button-quiet" type="button" onClick={onManage}><Settings2 size={15} /> 管理提示词</button></div>
    <label className="pd-search"><Search size={16} /><input ref={inputRef} value={query} aria-label="快速搜索提示词" placeholder="输入标题、标签或正文" onChange={event => { setQuery(event.target.value); setActive(0); }} /></label>
    {!query && favorites.length > 0 && <h3 className="pd-group-label"><Star size={14} /> 收藏</h3>}
    <div className="pd-quick-results" role="list">{results.map((prompt, index) => <button className={index === active ? 'is-active' : ''} type="button" role="listitem" key={prompt.id} onClick={() => choose(prompt)}><strong>{prompt.title}</strong><span>{prompt.tags.join(' · ') || prompt.content.slice(0, 58)}</span></button>)}</div>
    {!query && recent.length > 0 && <p className="pd-help">上方已合并最多 5 条收藏与 5 条最近使用记录。</p>}
    {!results.length && <div className="pd-empty"><strong>没有可显示的提示词</strong><span>可在管理提示词中添加或收藏模板。</span></div>}
    <button className="pd-button pd-button-secondary pd-full" type="button" onClick={onManage}>浏览全部</button>
  </section>;
};
