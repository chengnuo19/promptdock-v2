import { describe, expect, it } from 'vitest';
import { createBackupJson, mergeImportedState, parseBackupJson } from './backup';
import { createDefaultState } from './state';

describe('PromptDock backups', () => {
  it('round trips a versioned backup envelope', () => {
    const state = createDefaultState();
    state.favoriteIds = ['builtin_code_review'];

    const parsed = parseBackupJson(createBackupJson(state, '2026-08-23T00:00:00.000Z'));

    expect(parsed.exportedAt).toBe('2026-08-23T00:00:00.000Z');
    expect(parsed.data.favoriteIds).toEqual(['builtin_code_review']);
  });

  it('rejects unknown or malformed backup data', () => {
    expect(() => parseBackupJson('{"format":"other"}')).toThrow('无法识别');
    expect(() => parseBackupJson('not-json')).toThrow('不是有效');
  });

  it('merges records by id while retaining current settings', () => {
    const current = createDefaultState();
    current.settings.drawerWidth = 500;
    current.favoriteIds = ['current'];
    const imported = createDefaultState();
    imported.settings.drawerWidth = 360;
    imported.favoriteIds = ['imported'];
    imported.hiddenBuiltinIds = ['builtin_translate'];

    const merged = mergeImportedState(current, imported);

    expect(merged.settings.drawerWidth).toBe(500);
    expect(merged.favoriteIds).toEqual(expect.arrayContaining(['current', 'imported']));
    expect(merged.hiddenBuiltinIds).toEqual(['builtin_translate']);
  });
});

