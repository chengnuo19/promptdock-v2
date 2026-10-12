import { useEffect, useMemo, useRef, useState } from 'react';
import { findInlineCommand } from '../domain/inlineCommand';
import { extractVariables, fillPromptVariables, initialVariableValues, rankPrompts } from '../domain/promptLogic';
import type { ComposerRange, PromptDockStateV2, PromptTemplate, SiteAdapter } from '../types';

type MenuState = { query: string; range: ComposerRange; left: number; top: number } | null;

export const InlineCommandMenu = ({ adapter, composer, prompts: allPrompts, state, onUsed }: {
  adapter: SiteAdapter;
  composer: HTMLElement;
  prompts: PromptTemplate[];
  state: PromptDockStateV2;
  onUsed: (id: string, variableValues: Record<string, string>) => void;
}) => {
  const [menu, setMenu] = useState<MenuState>(null);
  const [active, setActive] = useState(0);
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const fieldRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const prompts = useMemo(() => {
    const ranked = rankPrompts(
      allPrompts,
      menu?.query ?? '',
      { favoriteIds: state.favoriteIds, usage: state.usage },
    );
    if (menu?.query) return ranked;
    const favorites = ranked.filter(prompt => state.favoriteIds.includes(prompt.id));
    const recent = ranked.filter(prompt => !state.favoriteIds.includes(prompt.id) && state.usage[prompt.id]);
    return [...favorites, ...recent].slice(0, 8);
  }, [allPrompts, menu?.query, state.favoriteIds, state.usage]);
  const refresh = () => {
    if (composing.current) return;
    const selection = adapter.readSelection(composer);
    if (!selection) return setMenu(null);
    const command = findInlineCommand(selection.text, selection.range.end);
    if (!command) return setMenu(null);
    const anchor = selection.caretRect ?? composer.getBoundingClientRect();
    setMenu({ query: command.query, range: command.range, left: Math.max(8, Math.min(anchor.left, innerWidth - 300)), top: Math.max(8, Math.min(anchor.bottom + 6, innerHeight - 260)) });
    setActive(0);
  };

  const choose = (next: PromptTemplate) => {
    if (extractVariables(next.content).length) {
      setTemplate(next);
      setValues(initialVariableValues(next.content, state.variableValues[next.id]));
      setMissing([]);
      requestAnimationFrame(() => fieldRef.current?.focus());
    } else insert(next);
  };
  const insert = (next: PromptTemplate) => {
    if (!menu) return;
    const result = fillPromptVariables(next.content, values);
    if (!result.ok) {
      setMissing(result.missing);
      requestAnimationFrame(() => fieldRef.current?.focus());
      return;
    }
    if (adapter.replaceRange(result.text, menu.range, composer).ok) {
      onUsed(next.id, extractVariables(next.content).length ? values : {});
      adapter.focusComposer(composer);
      setTemplate(null);
      setMenu(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!menu || composing.current) return;
    if (template) {
      if (event.key === 'Escape') { event.preventDefault(); setTemplate(null); setMissing([]); }
      if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); insert(template); }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(current => Math.max(0, Math.min(prompts.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter' && prompts[active]) {
      event.preventDefault();
      choose(prompts[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(null);
    }
  };

  // The handlers close over render-scoped state, so keep them in a ref and bind
  // the composer listeners once instead of re-registering on every render.
  const handlers = useRef({ refresh, onKeyDown });
  useEffect(() => { handlers.current = { refresh, onKeyDown }; });

  useEffect(() => {
    const onInput = () => handlers.current.refresh();
    const onStart = () => { composing.current = true; };
    const onEnd = () => { composing.current = false; handlers.current.refresh(); };
    const onKey = (event: KeyboardEvent) => handlers.current.onKeyDown(event);
    composer.addEventListener('input', onInput);
    composer.addEventListener('compositionstart', onStart);
    composer.addEventListener('compositionend', onEnd);
    composer.addEventListener('keydown', onKey);
    return () => {
      composer.removeEventListener('input', onInput);
      composer.removeEventListener('compositionstart', onStart);
      composer.removeEventListener('compositionend', onEnd);
      composer.removeEventListener('keydown', onKey);
    };
  }, [composer]);

  if (!menu) return null;
  const variables = template ? extractVariables(template.content) : [];
  return (
    <section className="pd-inline-menu" style={{ left: menu.left, top: menu.top }} role="dialog" aria-label="PromptDock 快捷提示词">
      {template ? <>
        <strong>{template.title}</strong><span>填写变量后按 Ctrl+Enter 插入</span>
        {variables.map(({ name, defaultValue }, index) => <label className={missing.includes(name) ? 'pd-field has-error' : 'pd-field'} key={name}>
          <span>{name}</span><input ref={index === 0 ? fieldRef : undefined} placeholder={defaultValue} value={values[name] ?? ''} onChange={event => setValues({ ...values, [name]: event.target.value })} />
        </label>)}
      </> : <>
        <strong>{menu.query ? `搜索「${menu.query}」` : '收藏与最近使用'}</strong>
        <div className="pd-inline-results">{prompts.slice(0, 8).map((prompt, index) => <button className={index === active ? 'is-active' : ''} type="button" key={prompt.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(prompt)}><b>{prompt.title}</b><span>{prompt.tags.join(' · ') || prompt.content.slice(0, 36)}</span></button>)}</div>
      </>}
    </section>
  );
};
