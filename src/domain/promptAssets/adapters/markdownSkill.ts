export interface MarkdownFrontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export async function parseMarkdownSkill(content: string): Promise<{
  name?: string;
  description?: string;
  instructions: string;
  constraints: string[];
  examples: string[];
  rawContent: string;
}> {
  const lines = content.split('\n');
  let name: string | undefined;
  let description: string | undefined;
  let instructions = '';
  const constraints: string[] = [];
  const examples: string[] = [];
  let inFrontmatter = false;
  let inConstraints = false;
  let inExamples = false;

  const frontmatterLines: string[] = [];
  const contentLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) {
      frontmatterLines.push(line);
    } else {
      contentLines.push(line);
    }
  }

  // Parse frontmatter
  for (const line of frontmatterLines) {
    const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === 'name') name = value;
      if (key === 'description') description = value;
    }
  }

  // Parse content
  let currentSection = '';
  for (const line of contentLines) {
    const trimmed = line.trim();
    if (trimmed === '## Constraints') {
      currentSection = 'constraints';
      inConstraints = true;
      continue;
    }
    if (trimmed === '## Examples') {
      currentSection = 'examples';
      inExamples = true;
      continue;
    }
    if (currentSection === 'constraints' && inConstraints) {
      if (trimmed && trimmed !== '## Constraints') {
        constraints.push(trimmed);
      }
      continue;
    }
    if (currentSection === 'examples' && inExamples) {
      if (trimmed && trimmed !== '## Examples') {
        examples.push(trimmed);
      }
      continue;
    }
    if (trimmed && !trimmed.startsWith('#')) {
      instructions += line + '\n';
    }
  }

  return {
    name,
    description,
    instructions: instructions.trim(),
    constraints,
    examples,
    rawContent: content
  };
}