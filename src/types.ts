export type PromptSource = 'builtin' | 'user';
export type InsertMode = 'append' | 'replace';
export type SiteName = 'chatgpt' | 'gemini';

export type PromptTemplate = {
  id: string;
  title: string;
  content: string;
  folderId: string;
  tags: string[];
  source: PromptSource;
  createdAt: number;
  updatedAt: number;
};

export type PromptOverride = Partial<Pick<PromptTemplate, 'title' | 'content' | 'folderId' | 'tags'>> & {
  updatedAt: number;
};

export type PromptFolder = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

/** One entry per prompt, so the library can rank by both frequency and recency. */
export type PromptUsage = {
  count: number;
  lastUsedAt: number;
};

/** `{{name}}` or `{{name:default}}` inside a prompt body. */
export type PromptVariable = {
  name: string;
  defaultValue: string;
};

export type PromptDockSettings = {
  drawerWidth: number;
  layoutRevision: 2;
  theme: 'auto';
  enabledSites: Record<SiteName, boolean>;
};

export type PromptDockStateV2 = {
  schemaVersion: 2;
  userPrompts: PromptTemplate[];
  builtinOverrides: Record<string, PromptOverride>;
  hiddenBuiltinIds: string[];
  folders: PromptFolder[];
  favoriteIds: string[];
  usage: Record<string, PromptUsage>;
  /** Last values the user typed for each prompt's variables, keyed by prompt id. */
  variableValues: Record<string, Record<string, string>>;
  settings: PromptDockSettings;
};

export type PromptDockBackup = {
  format: 'promptdock-backup';
  schemaVersion: 2;
  exportedAt: string;
  data: PromptDockStateV2;
};

export type InsertResult =
  | { ok: true }
  | { ok: false; reason: 'composer_unavailable' | 'write_failed' };

export type AttachFilesResult =
  | { ok: true; status: 'attached' | 'attempted' }
  | {
      ok: false;
      reason: 'upload_input_not_found' | 'site_rejected_files' | 'timeout' | 'unknown';
    };

export type ComposerRange = { start: number; end: number };

export type ComposerSelection = {
  text: string;
  range: ComposerRange;
  caretRect: DOMRect | null;
};

export type RichTextBlock = {
  type: 'paragraph' | 'heading' | 'list_item' | 'quote' | 'code';
  text: string;
  language?: string;
  href?: string;
};

export type AnswerSnapshot = {
  question: RichTextBlock[];
  answer: RichTextBlock[];
  questionText: string;
  answerText: string;
  capturedAt: number;
  sourceUrl: string;
};

export type AnswerBookmarkStatus = 'local' | 'syncing' | 'synced' | 'failed' | 'check_required';

export type AnswerBookmark = {
  id: string;
  site: SiteName;
  conversationId: string;
  conversationTitle: string;
  locator: string;
  snapshot: AnswerSnapshot;
  status: AnswerBookmarkStatus;
  hidden: boolean;
  syncedAt?: number;
  lastError?: string;
};

export type ConversationRecord = {
  id: string;
  site: SiteName;
  title: string;
  sourceUrl: string;
  notionDirectoryId?: string;
  notionPageId?: string;
};

export type AnswerBookmarksState = {
  bookmarks: AnswerBookmark[];
  conversations: Record<string, ConversationRecord>;
};

export type NotionDirectory = {
  id: string;
  name: string;
  databaseUrl: string;
  dataSourceId: string;
  titleProperty: string;
};

export type NotionConfig = { directories: NotionDirectory[] };

export interface ConversationAdapter {
  site: SiteName;
  getConversation(): ConversationRecord;
  messages(): HTMLElement[];
  actionBar(message: HTMLElement): HTMLElement | null;
  snapshot(message: HTMLElement): AnswerSnapshot | null;
  locator(message: HTMLElement): string;
  find(locator: string): HTMLElement | null;
  focus(locator: string): boolean;
}

/**
 * Everything PromptDock needs to know about one site, in one place. Adding a
 * site is a new file under `src/sites` plus a manifest match — the composer,
 * conversation and history layers all read from here.
 */
export type SiteDefinition = {
  name: SiteName;
  hostnames: string[];
  composer: {
    /** Sites differ in how ambiguous their composer is, so each brings its own lookup. */
    find(): HTMLElement | null;
    /** Passed to `closest()` to find the block the launcher is positioned against. */
    anchorSelector: string;
    fileInputSelectors: string[];
  };
  conversation: {
    messageSelector: string;
    assistantSelector: string;
    userSelector: string;
    actionBarSelectors: string[];
  };
  history: {
    /** Null when the site exposes no same-origin endpoint listing the conversation. */
    conversationId(href: string): string | null;
    conversationPath?(conversationId: string): string;
  };
};

export interface SiteAdapter {
  name: SiteName;
  findComposer(): HTMLElement | null;
  findAnchor(composer: HTMLElement): HTMLElement;
  readText(composer: HTMLElement): string;
  readSelection(composer: HTMLElement): ComposerSelection | null;
  replaceRange(text: string, range: ComposerRange, composer: HTMLElement): InsertResult;
  focusComposer(composer: HTMLElement): void;
  writeText(text: string, mode: InsertMode, composer: HTMLElement): InsertResult;
  attachFiles(files: File[]): Promise<AttachFilesResult>;
}
