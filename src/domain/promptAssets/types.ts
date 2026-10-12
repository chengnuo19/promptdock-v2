export type PromptAssetType = "prompt" | "template" | "style" | "skill" | "skillpack" | "example" | "constraint" | "reference";

export type PromptMediaType = "image" | "video" | "image-video" | "none";

export type CommercialUseStatus = "allowed" | "restricted" | "needs-review" | "unknown";

export interface PromptAssetSource {
  provider: "github" | "local" | "user";
  repository?: string;
  branch?: string;
  path?: string;
  url?: string;
  author?: string;
  license?: string;
  commitSha?: string;
  upstreamHash?: string;
  lastSync?: number;
  thirdPartyContent?: boolean;
  commercialUseStatus?: CommercialUseStatus;
}

export interface PromptAsset {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];

  assetType: PromptAssetType;
  mediaType: PromptMediaType;

  source: PromptAssetSource;

  upstreamPrompt?: string;
  customPrompt?: string | null;

  variables?: Array<{ name: string; defaultValue: string }>;
  constraints?: string[];
  negativePrompt?: string;

  supportedModels?: string[];
  supportedProviders?: string[];

  relations?: {
    styleIds?: string[];
    templateIds?: string[];
    exampleIds?: string[];
    relatedIds?: string[];
  };

  favorite?: boolean;
  enabled?: boolean;

  upstreamStatus?: "active" | "modified" | "removed";
  possibleDuplicate?: boolean;

  createdAt?: number;
  updatedAt?: number;
}