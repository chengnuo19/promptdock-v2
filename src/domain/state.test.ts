import { describe, expect, it } from 'vitest';
import { createDefaultState, normalizeState } from './state';

describe('responsive drawer settings', () => {
  it('uses the narrower 360px default', () => {
    expect(createDefaultState().settings.drawerWidth).toBe(360);
  });

  it('migrates the previous 420px default once without changing custom widths', () => {
    const previousDefault = createDefaultState();
    previousDefault.settings.drawerWidth = 420;
    delete (previousDefault.settings as Partial<typeof previousDefault.settings>).layoutRevision;

    const previousCustom = createDefaultState();
    previousCustom.settings.drawerWidth = 500;
    delete (previousCustom.settings as Partial<typeof previousCustom.settings>).layoutRevision;

    expect(normalizeState(previousDefault).settings).toMatchObject({ drawerWidth: 360, layoutRevision: 2 });
    expect(normalizeState(previousCustom).settings).toMatchObject({ drawerWidth: 500, layoutRevision: 2 });
  });
});

describe('usage migration', () => {
  it('turns a legacy timestamp into a counted usage record', () => {
    const legacy = createDefaultState();
    (legacy.usage as unknown as Record<string, number>).builtin_translate = 1700000000000;

    expect(normalizeState(legacy).usage).toEqual({
      builtin_translate: { count: 1, lastUsedAt: 1700000000000 },
    });
  });

  it('keeps counted records and fills in the new variableValues map', () => {
    const current = createDefaultState();
    current.usage.builtin_translate = { count: 4, lastUsedAt: 42 };

    const normalized = normalizeState(current);
    expect(normalized.usage.builtin_translate).toEqual({ count: 4, lastUsedAt: 42 });
    expect(normalized.variableValues).toEqual({});
  });
});
