// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptDockApp } from './PromptDockApp';
import type { SiteAdapter } from './types';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('PromptDockApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<form><textarea id="prompt-textarea"></textarea></form>';
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: (_keys: string[], callback: (result: Record<string, unknown>) => void) => callback({}),
          set: (_value: Record<string, unknown>, callback: () => void) => callback(),
        },
      },
    });
  });

  it('opens quick search and can browse all twenty builtin prompts', async () => {
    const composer = document.getElementById('prompt-textarea') as HTMLTextAreaElement;
    const anchor = composer.closest('form') as HTMLFormElement;
    anchor.getBoundingClientRect = () => ({
      x: 100, y: 500, left: 100, top: 500, right: 600, bottom: 560, width: 500, height: 60,
      toJSON: () => ({}),
    });
    const adapter: SiteAdapter = {
      name: 'chatgpt',
      findComposer: () => composer,
      findAnchor: () => anchor,
      readText: () => composer.value,
      readSelection: () => ({ text: composer.value, range: { start: composer.value.length, end: composer.value.length }, caretRect: null }),
      replaceRange: () => ({ ok: true }),
      focusComposer: () => composer.focus(),
      writeText: () => ({ ok: true }),
      attachFiles: async () => ({ ok: true, status: 'attempted' }),
    };

    render(<PromptDockApp adapter={adapter} composer={composer} />);
    fireEvent.click(screen.getByRole('button', { name: '打开 PromptDock' }));

    const drawer = await screen.findByRole('complementary', { name: 'PromptDock 提示词工作台' });
    fireEvent.click(within(drawer).getByRole('button', { name: '提示词' }));
    await waitFor(() => expect(within(drawer).getAllByRole('listitem')).toHaveLength(20));
    expect(within(drawer).getByText('专业翻译')).not.toBeNull();
  });
});
