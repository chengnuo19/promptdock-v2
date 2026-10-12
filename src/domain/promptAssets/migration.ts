import type { PromptTemplate } from '../../types';
import { extractVariables } from '../promptLogic';
import type { PromptAsset } from './types';

export function existingPromptToAsset(prompt: PromptTemplate): PromptAsset {
  return {
    id: prompt.id,
    title: prompt.title,
    description: '',
    category: '',
    tags: [...prompt.tags],
    assetType: 'prompt',
    mediaType: 'none',
    source: {
      provider: 'local',
      repository: undefined,
      branch: undefined,
      path: undefined,
      url: undefined,
      author: undefined,
      license: undefined,
      commitSha: undefined,
      upstreamHash: undefined,
      lastSync: undefined,
      thirdPartyContent: false,
      commercialUseStatus: 'unknown',
    },
    upstreamPrompt: prompt.content,
    customPrompt: null,
    variables: extractVariables(prompt.content),
    constraints: undefined,
    negativePrompt: undefined,
    supportedModels: undefined,
    supportedProviders: undefined,
    relations: undefined,
    favorite: false,
    enabled: true,
    upstreamStatus: 'active',
    possibleDuplicate: false,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
  };
}
