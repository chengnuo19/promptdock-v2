import type { PromptAssetSource } from './types';

export const PROMPT_SOURCE_REGISTRY: Record<string, PromptAssetSource> = {
  'freestylefly/awesome-gpt-image-2': {
    provider: 'github',
    repository: 'freestylefly/awesome-gpt-image-2',
    path: 'data/style-library.json',
    commercialUseStatus: 'needs-review'
  },
  'OpenSenseNova/SenseNova-Skills': {
    provider: 'github',
    repository: 'OpenSenseNova/SenseNova-Skills'
  },
  'PixVerseAI/skills': {
    provider: 'github',
    repository: 'PixVerseAI/skills'
  },
  'HalfAI1102/anthropic-art': {
    provider: 'github',
    repository: 'HalfAI1102/anthropic-art',
    path: 'skill/SKILL.md'
  },
  'ZzzLc0405/photo-abstract-editorial': {
    provider: 'github',
    repository: 'ZzzLc0405/photo-abstract-editorial',
    path: 'SKILL.md'
  },
  'K-Dense-AI/scientific-agent-skills': {
    provider: 'github',
    repository: 'K-Dense-AI/scientific-agent-skills',
    path: 'skills/scientific-schematics/SKILL.md'
  },
  'sylvanding/nature-publication-skills': {
    provider: 'github',
    repository: 'sylvanding/nature-publication-skills',
    path: 'SKILL.md'
  },
  'Hollis36/claude-skill': {
    provider: 'github',
    repository: 'Hollis36/claude-skill',
    path: 'SKILL.md'
  }
};