import { describe, it, expect } from 'vitest';
import {
  projectResearch,
  parseFrontmatter,
  parseLinksSection,
} from '../researchProjector';

const SAMPLE_MD = `---
markerNumber: "95"
generatedAt: "2026-02-28"
---

## Grokipedia

- [Battle of the Alamo](https://grokipedia.com/article/Battle_of_the_Alamo)
  The Alamo mission in San Antonio was the site of the pivotal 1836 battle
  during the Texas Revolution.

- [Texas Revolution](https://grokipedia.com/article/Texas_Revolution)
  The broader independence movement that this marker commemorates.

## Wikipedia

- [Alamo Mission in San Antonio](https://en.wikipedia.org/wiki/Alamo_Mission_in_San_Antonio)
  Originally known as Mision San Antonio de Valero, this 18th-century mission
  became a fortress during the Texas Revolution.

## Related

- [The Alamo Official Site](https://www.thealamo.org)
  The official website for the Alamo, offering virtual tours and visitor info.
`;

describe('parseFrontmatter', () => {
  it('extracts YAML frontmatter and body', () => {
    const { meta, body } = parseFrontmatter(SAMPLE_MD);
    expect(meta.markerNumber).toBe('95');
    expect(meta.generatedAt).toBe('2026-02-28');
    expect(body).toContain('## Grokipedia');
    expect(body).not.toContain('---');
  });

  it('returns empty meta for markdown without frontmatter', () => {
    const { meta, body } = parseFrontmatter('## Just a heading\nSome text');
    expect(meta).toEqual({});
    expect(body).toContain('## Just a heading');
  });

  it('handles empty input', () => {
    const { meta, body } = parseFrontmatter('');
    expect(meta).toEqual({});
    expect(body).toBe('');
  });
});

describe('parseLinksSection', () => {
  const section = `- [Battle of the Alamo](https://grokipedia.com/article/Battle_of_the_Alamo)
  The Alamo mission in San Antonio was the site of the pivotal 1836 battle
  during the Texas Revolution.

- [Texas Revolution](https://grokipedia.com/article/Texas_Revolution)
  The broader independence movement that this marker commemorates.`;

  it('parses links with title, url, and description', () => {
    const links = parseLinksSection(section, 'grokipedia');
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      title: 'Battle of the Alamo',
      url: 'https://grokipedia.com/article/Battle_of_the_Alamo',
      source: 'grokipedia',
      description: 'The Alamo mission in San Antonio was the site of the pivotal 1836 battle during the Texas Revolution.',
    });
    expect(links[1].title).toBe('Texas Revolution');
    expect(links[1].source).toBe('grokipedia');
  });

  it('handles single link', () => {
    const single = `- [One Link](https://example.com)
  A single link description.`;
    const links = parseLinksSection(single, 'wikipedia');
    expect(links).toHaveLength(1);
    expect(links[0].source).toBe('wikipedia');
  });

  it('returns empty array for empty section', () => {
    expect(parseLinksSection('', 'curated')).toEqual([]);
  });

  it('skips malformed lines', () => {
    const malformed = `- [Good Link](https://example.com)
  Valid description.

This is not a link item

- [Another Good Link](https://example2.com)
  Another valid description.`;
    const links = parseLinksSection(malformed, 'curated');
    expect(links).toHaveLength(2);
  });
});

describe('projectResearch', () => {
  it('parses complete research markdown into MarkerResearch', () => {
    const result = projectResearch(SAMPLE_MD);
    expect(result).not.toBeNull();
    expect(result!.markerNumber).toBe('95');
    expect(result!.generatedAt).toBe('2026-02-28');
    expect(result!.links).toHaveLength(4);
  });

  it('correctly assigns source types', () => {
    const result = projectResearch(SAMPLE_MD)!;
    const grokLinks = result.links.filter((l) => l.source === 'grokipedia');
    const wikiLinks = result.links.filter((l) => l.source === 'wikipedia');
    const curatedLinks = result.links.filter((l) => l.source === 'curated');
    expect(grokLinks).toHaveLength(2);
    expect(wikiLinks).toHaveLength(1);
    expect(curatedLinks).toHaveLength(1);
  });

  it('returns null for empty input', () => {
    expect(projectResearch('')).toBeNull();
  });

  it('returns null for invalid input without frontmatter', () => {
    expect(projectResearch('just some text')).toBeNull();
  });

  it('handles markdown with missing sections gracefully', () => {
    const partial = `---
markerNumber: "42"
generatedAt: "2026-01-15"
---

## Grokipedia

- [Some Article](https://grokipedia.com/article/Some_Article)
  A description of this article.
`;
    const result = projectResearch(partial);
    expect(result).not.toBeNull();
    expect(result!.markerNumber).toBe('42');
    expect(result!.links).toHaveLength(1);
    expect(result!.links[0].source).toBe('grokipedia');
  });

  it('handles markdown with only Related section', () => {
    const relatedOnly = `---
markerNumber: "100"
generatedAt: "2026-01-20"
---

## Related

- [Local Museum](https://localmuseum.org)
  A museum related to this marker.
`;
    const result = projectResearch(relatedOnly);
    expect(result).not.toBeNull();
    expect(result!.links).toHaveLength(1);
    expect(result!.links[0].source).toBe('curated');
  });
});

describe('projectResearch ignores headings that are Object.prototype keys [OMA-FUNC-LEARN-4]', () => {
  it.each(['Constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'a "## %s" section contributes no links',
    (heading) => {
      const md = `---\nmarkerNumber: "1"\n---\n\n## ${heading}\n\n- [A](https://a.example)\n  Description.\n\n## Related\n\n- [B](https://b.example)\n  Kept.\n`;
      const result = projectResearch(md)!;
      expect(result.links).toEqual([
        { title: 'B', url: 'https://b.example', source: 'curated', description: 'Kept.' },
      ]);
    },
  );
});
