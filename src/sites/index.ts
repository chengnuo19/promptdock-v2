import type { SiteDefinition, SiteName } from '../types';
import { chatGptSite } from './chatgpt';
import { geminiSite } from './gemini';

export { chatGptSite } from './chatgpt';
export { geminiSite } from './gemini';
export { getChatGptConversationId } from './chatgpt';

export const SITES: readonly SiteDefinition[] = [chatGptSite, geminiSite];

export const getSite = (hostname = window.location.hostname): SiteDefinition | null => SITES
  .find(site => site.hostnames.includes(hostname)) ?? null;

export const getSiteByName = (name: SiteName): SiteDefinition => SITES
  .find(site => site.name === name) ?? chatGptSite;
