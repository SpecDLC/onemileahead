import type { MarkerResearch, ResearchLink, LinkSource } from '../src/types/research';

const SECTION_ORDER: Array<{ source: LinkSource; heading: string }> = [
  { source: 'grokipedia', heading: 'Grokipedia' },
  { source: 'wikipedia', heading: 'Wikipedia' },
  { source: 'curated', heading: 'Related' },
];

export function generateResearchMarkdown(research: MarkerResearch): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`markerNumber: "${research.markerNumber}"`);
  lines.push(`generatedAt: "${research.generatedAt}"`);
  lines.push('---');

  // Group links by source
  const grouped = new Map<LinkSource, ResearchLink[]>();
  for (const link of research.links) {
    const list = grouped.get(link.source) || [];
    list.push(link);
    grouped.set(link.source, list);
  }

  // Write sections in order
  for (const { source, heading } of SECTION_ORDER) {
    const links = grouped.get(source);
    if (!links || links.length === 0) continue;

    lines.push('');
    lines.push(`## ${heading}`);
    lines.push('');

    for (const link of links) {
      lines.push(`- [${link.title}](${link.url})`);
      lines.push(`  ${link.description}`);
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}
