// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../domain/state';
import { SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  it('offers a per-item restore action for hidden builtin prompts', () => {
    const state = createDefaultState();
    state.hiddenBuiltinIds = ['builtin_translate'];
    const restore = vi.fn();

    render(
      <SettingsPanel
        state={state}
        onChange={vi.fn()}
        onRestoreBuiltin={restore}
        onRestoreBuiltins={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '恢复「专业翻译」' }));
    expect(restore).toHaveBeenCalledWith('builtin_translate');
  });
});
