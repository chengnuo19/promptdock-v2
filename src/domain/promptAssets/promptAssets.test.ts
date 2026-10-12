import { describe, expect, it } from 'vitest';

import type { PromptTemplate } from '../../types';
import { GitHubPromptClient } from '../../integrations/githubPromptClient';
import { existingPromptToAsset } from './migration';
import { computeUpstreamHash, normalizeContent } from './normalizer';
import { PROMPT_SOURCE_REGISTRY } from './sourceRegistry';
import { parseMarkdownSkill } from './adapters/markdownSkill';
import { AwesomeGPTImage2Adapter } from './adapters/awesomeGptImage2';

const makePrompt = (
  overrides: Partial<PromptTemplate> = {},
): PromptTemplate => ({
  id: 'prompt-1',
  title: 'Test Prompt',
  content: 'Summarize {{topic}} in {{language:English}}',
  folderId: '',
  tags: ['test'],
  source: 'user',
  createdAt: 100,
  updatedAt: 200,
  ...overrides,
});

describe('Phase 2A: PromptAsset foundation', () => {
  describe('existingPromptToAsset', () => {
    it('preserves the existing prompt identity and content', () => {
      const prompt = makePrompt();

      const asset = existingPromptToAsset(prompt);

      expect(asset.id).toBe(prompt.id);
      expect(asset.title).toBe(prompt.title);
      expect(asset.upstreamPrompt).toBe(prompt.content);
      expect(asset.customPrompt).toBeNull();
      expect(asset.source.provider).toBe('local');
      expect(asset.favorite).toBe(false);
      expect(asset.enabled).toBe(true);
      expect(asset.upstreamStatus).toBe('active');
    });

    it('copies tags instead of sharing the input array', () => {
      const prompt = makePrompt({
        tags: ['alpha', 'beta'],
      });

      const asset = existingPromptToAsset(prompt);

      expect(asset.tags).toEqual(['alpha', 'beta']);
      expect(asset.tags).not.toBe(prompt.tags);
    });

    it('uses the existing variable parser', () => {
      const prompt = makePrompt({
        content: 'Summarize {{topic}} in {{language:English}}',
      });

      const asset = existingPromptToAsset(prompt);

      expect(asset.variables).toEqual([
        {
          name: 'topic',
          defaultValue: '',
        },
        {
          name: 'language',
          defaultValue: 'English',
        },
      ]);
    });

    it('does not mutate the input PromptTemplate', () => {
      const prompt = makePrompt({
        tags: ['original'],
      });

      const snapshot: PromptTemplate = {
        ...prompt,
        tags: [...prompt.tags],
      };

      existingPromptToAsset(prompt);

      expect(prompt).toEqual(snapshot);
    });
  });

  describe('normalizer + upstreamHash', () => {
    it('normalizes CRLF to LF', () => {
      expect(normalizeContent('hello\r\nworld')).toBe('hello\nworld');
    });

    it('produces the same hash for CRLF and LF', async () => {
      const crlfHash = await computeUpstreamHash('hello\r\nworld');
      const lfHash = await computeUpstreamHash('hello\nworld');

      expect(crlfHash).toBe(lfHash);
    });

    it('ignores trailing whitespace on each line', async () => {
      const withWhitespace = await computeUpstreamHash(
        'hello   \nworld\t',
      );
      const clean = await computeUpstreamHash(
        'hello\nworld',
      );

      expect(withWhitespace).toBe(clean);
    });

    it('changes the hash when meaningful content changes', async () => {
      const lower = await computeUpstreamHash('hello\nworld');
      const upper = await computeUpstreamHash('hello\nWORLD');

      expect(lower).not.toBe(upper);
    });
  });

  describe('PROMPT_SOURCE_REGISTRY', () => {
    it('contains unique repository values', () => {
      const repositories = Object.values(PROMPT_SOURCE_REGISTRY)
        .map(source => source.repository)
        .filter((repository): repository is string => (
          typeof repository === 'string'
        ));

      expect(new Set(repositories).size).toBe(repositories.length);
    });

    it('keeps registry keys aligned with repository metadata', () => {
      for (const [key, source] of Object.entries(PROMPT_SOURCE_REGISTRY)) {
        expect(source.repository).toBe(key);
        expect(source.provider).toBe('github');
      }
    });

    it('contains the eight Phase 2A GitHub sources', () => {
      const repositories = Object.values(PROMPT_SOURCE_REGISTRY)
        .map(source => source.repository);

      expect(repositories).toEqual(expect.arrayContaining([
        'freestylefly/awesome-gpt-image-2',
        'OpenSenseNova/SenseNova-Skills',
        'PixVerseAI/skills',
        'HalfAI1102/anthropic-art',
        'ZzzLc0405/photo-abstract-editorial',
        'K-Dense-AI/scientific-agent-skills',
        'sylvanding/nature-publication-skills',
        'Hollis36/claude-skill',
      ]));
    });

    it('does not register fal.ai as a guessed source', () => {
      const repositories = Object.values(PROMPT_SOURCE_REGISTRY)
        .map(source => source.repository ?? '');

      expect(
        repositories.some(repository => (
          repository.toLowerCase().includes('fal.ai')
        )),
      ).toBe(false);
    });
  });

  describe('parseMarkdownSkill', () => {
    it('parses name and description from frontmatter', async () => {
      const content = `---
name: Test Skill
description: A test skill
---

# Heading

Use concise output.
`;

      const result = await parseMarkdownSkill(content);

      expect(result.name).toBe('Test Skill');
      expect(result.description).toBe('A test skill');
      expect(result.instructions).toBe('Use concise output.');
      expect(result.rawContent).toBe(content);
    });

    it('supports Markdown without frontmatter', async () => {
      const content = `# Heading

Plain instruction.
`;

      const result = await parseMarkdownSkill(content);

      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.instructions).toBe('Plain instruction.');
      expect(result.rawContent).toBe(content);
    });

    it('preserves malformed Markdown source without dropping it', async () => {
      const content = `---
name Test Skill

# Heading

Instruction that must not disappear.
`;

      const result = await parseMarkdownSkill(content);

      expect(result.rawContent).toBe(content);
    });

    it('keeps headings out of the instruction text', async () => {
      const content = `# Main Heading

Instruction one.

### Secondary Heading

Instruction two.
`;

      const result = await parseMarkdownSkill(content);

      expect(result.instructions).toContain('Instruction one.');
      expect(result.instructions).toContain('Instruction two.');
      expect(result.instructions).not.toContain('# Main Heading');
      expect(result.instructions).not.toContain('### Secondary Heading');
    });

    it('collects constraints and examples', async () => {
      const content = `---
name: Structured Skill
---

Use the supplied material.

## Constraints
- Keep it short
- Preserve facts

## Examples
- Example one
- Example two
`;

      const result = await parseMarkdownSkill(content);

      expect(result.instructions).toBe('Use the supplied material.');
      expect(result.constraints).toEqual([
        '- Keep it short',
        '- Preserve facts',
      ]);
      expect(result.examples).toEqual([
        '- Example one',
        '- Example two',
      ]);
      expect(result.rawContent).toBe(content);
    });
  });

  describe('AwesomeGPTImage2Adapter', () => {
    it('returns no fabricated assets in the Phase 2A skeleton', async () => {
      const adapter = new AwesomeGPTImage2Adapter();

      await expect(adapter.fetchAssets()).resolves.toEqual([]);
    });
  });

  describe('GitHubPromptClient', () => {
    it('rejects an invalid repository', async () => {
      const client = new GitHubPromptClient();

      await expect(client.fetchRawContent({
        provider: 'github',
        repository: 'invalid',
        path: 'README.md',
      })).rejects.toThrow('Invalid GitHub repository');
    });

    it('rejects a snapshot without a source path', async () => {
      const client = new GitHubPromptClient();

      await expect(client.fetchRawContent({
        provider: 'github',
        repository: 'owner/repo',
      })).rejects.toThrow('GitHub source path is required');
    });

    it('reaches the explicit NotImplemented boundary for a valid snapshot', async () => {
      const client = new GitHubPromptClient();

      await expect(client.fetchRawContent({
        provider: 'github',
        repository: 'owner/repo',
        branch: 'main',
        path: 'README.md',
      })).rejects.toThrow('NotImplemented');
    });
  });
});
