export interface SourceSnapshot {
  provider: 'github';
  repository: string;
  branch?: string;
  path?: string;
  commitSha?: string;
  rawContent?: string;
  url?: string;
  license?: string;
  author?: string;
}

export class GitHubPromptClient {
  private readonly baseUrl = 'https://api.github.com';

  private buildContentsUrl(snapshot: SourceSnapshot): string {
    const [owner, repo] = snapshot.repository.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository: ${snapshot.repository}`);
    }

    if (!snapshot.path) {
      throw new Error('GitHub source path is required');
    }

    const encodedPath = snapshot.path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');

    const url = new URL(
      `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
    );

    const ref = snapshot.commitSha ?? snapshot.branch;
    if (ref) {
      url.searchParams.set('ref', ref);
    }

    return url.toString();
  }

  async fetchRawContent(snapshot: SourceSnapshot): Promise<string> {
    const url = this.buildContentsUrl(snapshot);

    throw new Error(
      `NotImplemented: GitHub raw-content transport is not wired yet (${url})`,
    );
  }

  async fetchAsset(snapshot: SourceSnapshot): Promise<unknown> {
    const url = this.buildContentsUrl(snapshot);

    throw new Error(
      `NotImplemented: GitHub asset transport is not wired yet (${url})`,
    );
  }
}