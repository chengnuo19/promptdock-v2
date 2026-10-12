// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptLibraryPanel } from './PromptLibraryPanel';
import { resolvePrompts } from '../domain/promptLogic';
import { createDefaultState } from '../domain/state';
import type { PromptDockStateV2 } from '../types';

const renderPanel = (onChange = vi.fn()) => {
  const state: PromptDockStateV2 = createDefaultState();
  const prompts = resolvePrompts(state).slice(0, 3);
  render(
    <PromptLibraryPanel
      state={state}
      prompts={prompts}
      folders={state.folders}
      selectedId={prompts[0].id}
      onSelect={() => undefined}
      onSearch={() => undefined}
      onNew={() => undefined}
      onEdit={() => undefined}
      onDelete={() => undefined}
      onReset={() => undefined}
      onFavorite={() => undefined}
      onInsert={() => undefined}
      onChange={onChange}
    />,
  );
  return { state, prompts, onChange };
};

describe('PromptLibraryPanel', () => {
  // vitest globals are off, so testing-library's auto cleanup never runs.
  afterEach(cleanup);

  it('creates a personal copy of the selected prompt', () => {
    const { prompts, onChange } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: '创建副本' }));

    const [next, message] = onChange.mock.calls[0];
    expect(next.userPrompts).toHaveLength(1);
    expect(next.userPrompts[0]).toMatchObject({ title: `${prompts[0].title} 副本`, source: 'user' });
    expect(message).toContain('副本');
  });

  it('moves every listed prompt into a folder from bulk mode', () => {
    const { prompts, onChange } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: '批量操作' }));
    fireEvent.click(screen.getByRole('button', { name: '全选当前列表' }));
    expect(screen.getByText('已选 3 条')).not.toBeNull();

    const bulkBar = screen.getByRole('group', { name: '批量操作' });
    fireEvent.change(within(bulkBar).getByRole('combobox'), { target: { value: 'folder_office' } });

    const [next, message] = onChange.mock.calls[0];
    expect(prompts.every(prompt => next.builtinOverrides[prompt.id].folderId === 'folder_office')).toBe(true);
    expect(message).toContain('3 条');
    expect(screen.queryByRole('group', { name: '批量操作' })).toBeNull();
  });

  it('hides builtins instead of deleting them and says so before confirming', () => {
    const { onChange } = renderPanel();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: '批量操作' }));
    fireEvent.click(screen.getAllByRole('checkbox', { name: /^选择 / })[0]);
    fireEvent.click(screen.getByRole('button', { name: '删除选中项' }));

    expect(confirm.mock.calls[0][0]).toContain('只会被隐藏');
    expect(onChange.mock.calls[0][0].hiddenBuiltinIds).toHaveLength(1);
    confirm.mockRestore();
  });
});
