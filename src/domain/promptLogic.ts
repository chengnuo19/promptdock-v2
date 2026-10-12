import type { PromptDockStateV2, PromptTemplate, PromptUsage, PromptVariable } from '../types';
import { BUILTIN_PROMPTS } from './builtinPrompts';

const VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

/** `{{语言:中文}}` and `{{语言：中文}}` both declare a default; the first colon splits. */
const parseVariable = (raw: string): PromptVariable => {
  const separator = raw.search(/[:：]/);
  if (separator === -1) return { name: raw.trim(), defaultValue: '' };
  return {
    name: raw.slice(0, separator).trim(),
    defaultValue: raw.slice(separator + 1).trim(),
  };
};

export const extractVariables = (content: string): PromptVariable[] => {
  const variables: PromptVariable[] = [];
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const variable = parseVariable(match[1]);
    if (!variable.name || variables.some(item => item.name === variable.name)) continue;
    variables.push(variable);
  }
  return variables;
};

/** Values to show in the fill-in form: what the user typed last, else the default. */
export const initialVariableValues = (
  content: string,
  remembered: Record<string, string> = {},
): Record<string, string> => Object.fromEntries(extractVariables(content)
  .map(variable => [variable.name, remembered[variable.name] ?? variable.defaultValue]));

export const fillPromptVariables = (
  content: string,
  values: Record<string, string>,
): { ok: true; text: string } | { ok: false; missing: string[] } => {
  const variables = extractVariables(content);
  const resolved = new Map(variables.map(variable => [
    variable.name,
    (values[variable.name] ?? '').trim() || variable.defaultValue,
  ]));
  const missing = variables.filter(variable => !resolved.get(variable.name)).map(variable => variable.name);
  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    text: content.replace(VARIABLE_PATTERN, (whole, raw: string) => resolved.get(parseVariable(raw).name) ?? whole),
  };
};

export const resolvePrompts = (state: PromptDockStateV2): PromptTemplate[] => {
  const hidden = new Set(state.hiddenBuiltinIds);
  const builtins = BUILTIN_PROMPTS
    .filter(prompt => !hidden.has(prompt.id))
    .map(prompt => ({ ...prompt, ...state.builtinOverrides[prompt.id], source: 'builtin' as const }));
  return [...builtins, ...state.userPrompts];
};

export type PromptSearchContext = {
  favoriteIds?: readonly string[];
  usage?: Readonly<Record<string, PromptUsage>>;
};

const searchRank = (prompt: PromptTemplate, query: string): number | null => {
  const title = prompt.title.toLocaleLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (prompt.tags.some(tag => tag.toLocaleLowerCase().includes(query))) return 3;
  if (prompt.content.toLocaleLowerCase().includes(query)) return 4;
  return null;
};

/** Shared, deterministic search used by the quick drawer and the inline // menu. */
export const rankPrompts = (
  prompts: PromptTemplate[],
  query: string,
  context: PromptSearchContext = {},
): PromptTemplate[] => {
  const normalized = query.trim().toLocaleLowerCase();
  const favorites = new Set(context.favoriteIds ?? []);
  const usage = context.usage ?? {};
  const ranked = prompts
    .map(prompt => ({ prompt, rank: normalized ? searchRank(prompt, normalized) : 0 }))
    .filter((item): item is { prompt: PromptTemplate; rank: number } => item.rank !== null);

  return ranked.sort((a, b) => (
    a.rank - b.rank
    || Number(favorites.has(b.prompt.id)) - Number(favorites.has(a.prompt.id))
    || (usage[b.prompt.id]?.count ?? 0) - (usage[a.prompt.id]?.count ?? 0)
    || (usage[b.prompt.id]?.lastUsedAt ?? 0) - (usage[a.prompt.id]?.lastUsedAt ?? 0)
    || a.prompt.title.localeCompare(b.prompt.title, 'zh-CN')
  )).map(item => item.prompt);
};

export const parseTags = (value: string): string[] => [...new Set(value
  .split(/[,，\s]+/)
  .map(tag => tag.trim())
  .filter(Boolean))];

type PromptInput = Pick<PromptTemplate, 'title' | 'content' | 'folderId' | 'tags' | 'source'>
  & Partial<Pick<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>;

export const savePrompt = (
  state: PromptDockStateV2,
  input: PromptInput,
  now = Date.now(),
  generatedId: string = crypto.randomUUID(),
): PromptDockStateV2 => {
  if (input.source === 'builtin' && input.id) {
    return {
      ...state,
      builtinOverrides: {
        ...state.builtinOverrides,
        [input.id]: {
          title: input.title.trim(),
          content: input.content.trim(),
          folderId: input.folderId,
          tags: [...input.tags],
          updatedAt: now,
        },
      },
      hiddenBuiltinIds: state.hiddenBuiltinIds.filter(id => id !== input.id),
    };
  }

  const existing = input.id ? state.userPrompts.find(prompt => prompt.id === input.id) : undefined;
  const record: PromptTemplate = {
    id: input.id ?? generatedId,
    title: input.title.trim(),
    content: input.content.trim(),
    folderId: input.folderId,
    tags: [...input.tags],
    source: 'user',
    createdAt: existing?.createdAt ?? (input.createdAt || now),
    updatedAt: now,
  };
  return {
    ...state,
    userPrompts: existing
      ? state.userPrompts.map(prompt => prompt.id === record.id ? record : prompt)
      : [...state.userPrompts, record],
  };
};

const withoutKeys = <T>(record: Record<string, T>, removed: ReadonlySet<string>): Record<string, T> => Object
  .fromEntries(Object.entries(record).filter(([key]) => !removed.has(key)));

/** Drops the per-prompt records that would otherwise linger after a deletion. */
const forgetPrompts = (state: PromptDockStateV2, removed: ReadonlySet<string>): PromptDockStateV2 => ({
  ...state,
  favoriteIds: state.favoriteIds.filter(id => !removed.has(id)),
  usage: withoutKeys(state.usage, removed),
  variableValues: withoutKeys(state.variableValues, removed),
});

export const deletePrompt = (state: PromptDockStateV2, promptId: string): PromptDockStateV2 => {
  const isBuiltin = BUILTIN_PROMPTS.some(prompt => prompt.id === promptId);
  const next = isBuiltin
    ? { ...state, hiddenBuiltinIds: [...new Set([...state.hiddenBuiltinIds, promptId])] }
    : { ...state, userPrompts: state.userPrompts.filter(prompt => prompt.id !== promptId) };
  return forgetPrompts(next, new Set([promptId]));
};

export const deletePrompts = (
  state: PromptDockStateV2,
  promptIds: readonly string[],
): PromptDockStateV2 => promptIds.reduce(deletePrompt, state);

const uniqueTitle = (existing: readonly string[], base: string): string => {
  const candidate = `${base} 副本`;
  if (!existing.includes(candidate)) return candidate;
  let index = 2;
  while (existing.includes(`${candidate} ${index}`)) index += 1;
  return `${candidate} ${index}`;
};

/** A copy is always a personal prompt, so builtins can be forked without overriding them. */
export const duplicatePrompt = (
  state: PromptDockStateV2,
  prompt: PromptTemplate,
  now = Date.now(),
  generatedId: string = crypto.randomUUID(),
): PromptDockStateV2 => ({
  ...state,
  userPrompts: [...state.userPrompts, {
    id: generatedId,
    title: uniqueTitle(resolvePrompts(state).map(item => item.title), prompt.title),
    content: prompt.content,
    folderId: prompt.folderId,
    tags: [...prompt.tags],
    source: 'user',
    createdAt: now,
    updatedAt: now,
  }],
});

export const restoreBuiltin = (state: PromptDockStateV2, promptId: string): PromptDockStateV2 => {
  const builtinOverrides = { ...state.builtinOverrides };
  delete builtinOverrides[promptId];
  return {
    ...state,
    builtinOverrides,
    hiddenBuiltinIds: state.hiddenBuiltinIds.filter(id => id !== promptId),
  };
};

export const restoreAllBuiltins = (state: PromptDockStateV2): PromptDockStateV2 => ({
  ...state,
  builtinOverrides: {},
  hiddenBuiltinIds: [],
});

export const deleteFolder = (
  state: PromptDockStateV2,
  folderId: string,
  now = Date.now(),
): PromptDockStateV2 => {
  const builtinOverrides = { ...state.builtinOverrides };
  resolvePrompts(state)
    .filter(prompt => prompt.source === 'builtin' && prompt.folderId === folderId)
    .forEach(prompt => {
      builtinOverrides[prompt.id] = { ...builtinOverrides[prompt.id], folderId: '', updatedAt: now };
    });

  return {
    ...state,
    folders: state.folders.filter(folder => folder.id !== folderId),
    userPrompts: state.userPrompts.map(prompt => prompt.folderId === folderId
      ? { ...prompt, folderId: '', updatedAt: now }
      : prompt),
    builtinOverrides,
  };
};

export const toggleFavorite = (state: PromptDockStateV2, promptId: string): PromptDockStateV2 => ({
  ...state,
  favoriteIds: state.favoriteIds.includes(promptId)
    ? state.favoriteIds.filter(id => id !== promptId)
    : [...state.favoriteIds, promptId],
});

export const recordPromptUse = (
  state: PromptDockStateV2,
  promptId: string,
  usedAt = Date.now(),
): PromptDockStateV2 => ({
  ...state,
  usage: {
    ...state.usage,
    [promptId]: { count: (state.usage[promptId]?.count ?? 0) + 1, lastUsedAt: usedAt },
  },
});

export const rememberVariableValues = (
  state: PromptDockStateV2,
  promptId: string,
  values: Record<string, string>,
): PromptDockStateV2 => {
  const kept = Object.entries(values).filter(([, value]) => value.trim());
  if (!kept.length) return state;
  return {
    ...state,
    variableValues: { ...state.variableValues, [promptId]: Object.fromEntries(kept) },
  };
};

/** Bulk edits only touch personal prompts directly; builtins get an override. */
const editPrompts = (
  state: PromptDockStateV2,
  promptIds: readonly string[],
  change: (prompt: PromptTemplate) => Partial<PromptTemplate>,
  now: number,
): PromptDockStateV2 => {
  const targets = new Set(promptIds);
  const builtinOverrides = { ...state.builtinOverrides };
  resolvePrompts(state)
    .filter(prompt => prompt.source === 'builtin' && targets.has(prompt.id))
    .forEach(prompt => {
      builtinOverrides[prompt.id] = { ...builtinOverrides[prompt.id], ...change(prompt), updatedAt: now };
    });

  return {
    ...state,
    builtinOverrides,
    userPrompts: state.userPrompts.map(prompt => targets.has(prompt.id)
      ? { ...prompt, ...change(prompt), updatedAt: now }
      : prompt),
  };
};

export const movePromptsToFolder = (
  state: PromptDockStateV2,
  promptIds: readonly string[],
  folderId: string,
  now = Date.now(),
): PromptDockStateV2 => editPrompts(state, promptIds, () => ({ folderId }), now);

export const addTagsToPrompts = (
  state: PromptDockStateV2,
  promptIds: readonly string[],
  tags: readonly string[],
  now = Date.now(),
): PromptDockStateV2 => tags.length
  ? editPrompts(state, promptIds, prompt => ({ tags: [...new Set([...prompt.tags, ...tags])] }), now)
  : state;
