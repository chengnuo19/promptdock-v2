import type { PromptDockStateV2, PromptUsage } from '../types';
import { BUILTIN_FOLDERS } from './builtinPrompts';

export const DEFAULT_DRAWER_WIDTH = 360;
export const MIN_DRAWER_WIDTH = 360;
export const MAX_DRAWER_WIDTH = 640;

export const createDefaultState = (): PromptDockStateV2 => ({
  schemaVersion: 2,
  userPrompts: [],
  builtinOverrides: {},
  hiddenBuiltinIds: [],
  folders: BUILTIN_FOLDERS.map(folder => ({ ...folder })),
  favoriteIds: [],
  usage: {},
  variableValues: {},
  settings: {
    drawerWidth: DEFAULT_DRAWER_WIDTH,
    layoutRevision: 2,
    theme: 'auto',
    enabledSites: { chatgpt: true, gemini: true },
  },
});

export const isPromptDockState = (value: unknown): value is PromptDockStateV2 => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<PromptDockStateV2>;
  return state.schemaVersion === 2
    && Array.isArray(state.userPrompts)
    && state.builtinOverrides !== null
    && typeof state.builtinOverrides === 'object'
    && Array.isArray(state.hiddenBuiltinIds)
    && Array.isArray(state.folders)
    && Array.isArray(state.favoriteIds)
    && state.usage !== null
    && typeof state.usage === 'object'
    && Boolean(state.settings)
    && typeof state.settings?.drawerWidth === 'number';
};

/** Before 2.2 a usage entry was just the last-used timestamp. */
const normalizeUsage = (usage: PromptDockStateV2['usage'] | undefined): Record<string, PromptUsage> => {
  const entries = Object.entries(usage ?? {}).map(([id, value]) => [
    id,
    typeof value === 'number'
      ? { count: 1, lastUsedAt: value }
      : { count: Math.max(0, Math.round(value?.count ?? 0)), lastUsedAt: value?.lastUsedAt ?? 0 },
  ] as const);
  return Object.fromEntries(entries);
};

const normalizeDrawerWidth = (settings: PromptDockStateV2['settings'] | undefined): number => {
  // The 2.0 default of 420px moves to the new 360px default exactly once; any
  // width the user picked themselves is kept as-is.
  const stored = settings?.layoutRevision === 2 || settings?.drawerWidth !== 420
    ? settings?.drawerWidth ?? DEFAULT_DRAWER_WIDTH
    : DEFAULT_DRAWER_WIDTH;
  return Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, stored));
};

export const normalizeState = (state: PromptDockStateV2): PromptDockStateV2 => ({
  ...createDefaultState(),
  ...state,
  userPrompts: state.userPrompts ?? [],
  builtinOverrides: state.builtinOverrides ?? {},
  hiddenBuiltinIds: [...new Set(state.hiddenBuiltinIds ?? [])],
  folders: state.folders ?? [],
  favoriteIds: [...new Set(state.favoriteIds ?? [])],
  usage: normalizeUsage(state.usage),
  variableValues: state.variableValues ?? {},
  settings: {
    ...createDefaultState().settings,
    ...state.settings,
    drawerWidth: normalizeDrawerWidth(state.settings),
    layoutRevision: 2,
  },
});
