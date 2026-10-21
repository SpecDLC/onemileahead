import type { LinkSource, ResearchLink, MarkerResearch } from '../types/research';

// A Map, not an object literal: looking up a heading such as "constructor" or "__proto__" in a
// plain object returns an Object.prototype member [OMA-FUNC-LEARN-4].
const SECTION_MAP: ReadonlyMap<string, LinkSource> = new Map<string, LinkSource>([
  ['grokipedia', 'grokipedia'],
  ['wikipedia', 'wikipedia'],
  ['related', 'curated'],
]);

export function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const trimmed = md.trim();
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: trimmed };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { meta: {}, body: trimmed };
  }

  const yamlBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();

  const meta: Record<string, string> = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body };
}

export function parseLinksSection(section: string, source: LinkSource): ResearchLink[] {
  if (!section.trim()) return [];

  const links: ResearchLink[] = [];
  const lines = section.split('\n');

  let currentTitle = '';
  let currentUrl = '';
  let descLines: string[] = [];

  function flush() {
    if (currentTitle && currentUrl) {
      links.push({
        title: currentTitle,
        url: currentUrl,
        source,
        description: descLines.join(' ').trim(),
      });
    }
    currentTitle = '';
    currentUrl = '';
    descLines = [];
  }

  for (const line of lines) {
    const linkMatch = line.match(/^- \[(.+?)]\((.+?)\)\s*$/);
    if (linkMatch) {
      flush();
      currentTitle = linkMatch[1];
      currentUrl = linkMatch[2];
    } else if (currentTitle && line.match(/^\s+\S/)) {
      descLines.push(line.trim());
    } else if (line.trim() === '') {
      // blank line — continue accumulating if we have a current link
    } else {
      // non-matching, non-indented line — skip
    }
  }

  flush();
  return links;
}

export function projectResearch(markdown: string): MarkerResearch | null {
  if (!markdown.trim()) return null;

  const { meta, body } = parseFrontmatter(markdown);
  if (!meta.markerNumber) return null;

  const links: ResearchLink[] = [];

  // Split body by ## headings
  const sectionRegex = /^## (.+)$/gm;
  const sections: Array<{ heading: string; content: string }> = [];
  let match: RegExpExecArray | null;
  const headingPositions: Array<{ heading: string; start: number }> = [];

  while ((match = sectionRegex.exec(body)) !== null) {
    headingPositions.push({ heading: match[1], start: match.index + match[0].length });
  }

  for (let i = 0; i < headingPositions.length; i++) {
    const start = headingPositions[i].start;
    const end = i + 1 < headingPositions.length
      ? body.lastIndexOf('##', headingPositions[i + 1].start)
      : body.length;
    sections.push({
      heading: headingPositions[i].heading,
      content: body.slice(start, end).trim(),
    });
  }

  for (const section of sections) {
    const source = SECTION_MAP.get(section.heading.toLowerCase());
    if (source) {
      links.push(...parseLinksSection(section.content, source));
    }
  }

  return {
    markerNumber: meta.markerNumber,
    generatedAt: meta.generatedAt || '',
    links,
  };
}
