import type { PromptDockBackup, PromptDockStateV2, PromptUsage } from '../types';
import { isPromptDockState, normalizeState } from './state';

/** Keep the larger counter on both sides so re-importing a backup never double counts. */
const mergeUsage = (
  current: Record<string, PromptUsage>,
  imported: Record<string, PromptUsage>,
): Record<string, PromptUsage> => Object.fromEntries(
  [...new Set([...Object.keys(current), ...Object.keys(imported)])].map(id => [id, {
    count: Math.max(current[id]?.count ?? 0, imported[id]?.count ?? 0),
    lastUsedAt: Math.max(current[id]?.lastUsedAt ?? 0, imported[id]?.lastUsedAt ?? 0),
  }]),
);

const upsertById = <T extends { id: string }>(current: T[], imported: T[]): T[] => {
  const records = new Map(current.map(item => [item.id, item]));
  imported.forEach(item => records.set(item.id, item));
  return [...records.values()];
};

export const createBackupJson = (state: PromptDockStateV2, exportedAt = new Date().toISOString()): string => {
  const backup: PromptDockBackup = {
    format: 'promptdock-backup',
    schemaVersion: 2,
    exportedAt,
    data: normalizeState(state),
  };
  return JSON.stringify(backup, null, 2);
};

export const parseBackupJson = (raw: string): PromptDockBackup => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('所选文件不是有效的 JSON。');
  }

  if (!value || typeof value !== 'object') throw new Error('无法识别该备份文件。');
  const backup = value as Partial<PromptDockBackup>;
  if (backup.format !== 'promptdock-backup' || backup.schemaVersion !== 2 || !isPromptDockState(backup.data)) {
    throw new Error('无法识别该备份文件或其版本不受支持。');
  }

  return {
    format: 'promptdock-backup',
    schemaVersion: 2,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    data: normalizeState(backup.data),
  };
};

export const mergeImportedState = (
  current: PromptDockStateV2,
  imported: PromptDockStateV2,
): PromptDockStateV2 => normalizeState({
  ...current,
  userPrompts: upsertById(current.userPrompts, imported.userPrompts),
  folders: upsertById(current.folders, imported.folders),
  builtinOverrides: { ...current.builtinOverrides, ...imported.builtinOverrides },
  hiddenBuiltinIds: [...new Set([...current.hiddenBuiltinIds, ...imported.hiddenBuiltinIds])],
  favoriteIds: [...new Set([...current.favoriteIds, ...imported.favoriteIds])],
  usage: mergeUsage(current.usage, imported.usage),
  variableValues: { ...current.variableValues, ...imported.variableValues },
  settings: current.settings,
});

