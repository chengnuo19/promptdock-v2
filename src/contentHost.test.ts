// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureExtensionHost, HOST_ID, removeExtensionHost } from './contentHost';

describe('extension host', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates exactly one shadow host across repeated SPA syncs', () => {
    const first = ensureExtensionHost(document);
    const second = ensureExtensionHost(document);

    expect(first.host).toBe(second.host);
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    expect(first.mount.id).toBe('promptdock-root');
  });

  it('removes the host when the composer disappears', () => {
    ensureExtensionHost(document);
    removeExtensionHost(document);
    expect(document.getElementById(HOST_ID)).toBeNull();
  });
});

