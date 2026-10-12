// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SITES, getSite, getSiteByName } from './index';
import { getAdapter } from '../adapters';
import { getConversationAdapter } from '../conversationAdapters';

describe('site registry', () => {
  it('resolves every declared hostname to its own definition', () => {
    const hostnames = SITES.flatMap(site => site.hostnames);
    expect(hostnames).toEqual([...new Set(hostnames)]);
    hostnames.forEach(hostname => {
      expect(getSite(hostname)?.hostnames).toContain(hostname);
    });
    expect(getSite('example.com')).toBeNull();
  });

  it('gives the composer and conversation layers the same definition per site', () => {
    SITES.forEach(site => {
      expect(getSiteByName(site.name)).toBe(site);
      site.hostnames.forEach(hostname => {
        expect(getAdapter(hostname)?.name).toBe(site.name);
      });
      expect(getConversationAdapter(site.name).site).toBe(site.name);
    });
  });

  it('declares every field a new site has to fill in', () => {
    SITES.forEach(site => {
      expect(site.hostnames.length).toBeGreaterThan(0);
      expect(typeof site.composer.find).toBe('function');
      expect(site.composer.anchorSelector).toBeTruthy();
      expect(site.composer.fileInputSelectors.length).toBeGreaterThan(0);
      expect(site.conversation.messageSelector).toBeTruthy();
      expect(site.conversation.assistantSelector).toBeTruthy();
      expect(site.conversation.userSelector).toBeTruthy();
      expect(site.conversation.actionBarSelectors.length).toBeGreaterThan(0);
      expect(typeof site.history.conversationId).toBe('function');
    });
  });
});
