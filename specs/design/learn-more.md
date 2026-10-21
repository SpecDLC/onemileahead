# Design: Learn More Feature

## Architecture: Separation of Information and Presentation

### Information Layer (Markdown)
Per-marker research stored as `public/data/research/{markerNumber}.md`:
- YAML frontmatter: `markerNumber`, `generatedAt`
- `## Grokipedia` / `## Wikipedia` / `## Related` section headings
- List items with `[title](url)` + indented description

### Presentation Layer (TypeScript Projectors + React)
- `researchProjector.ts` — pure function: `string → MarkerResearch | null`
- `LearnMoreSection.tsx` — renders typed data as collapsible link list
- `LearnMoreLink.tsx` — renders a single `ResearchLink` as anchor card

## Data Flow

```
Markdown file → fetch as text → projectResearch() → MarkerResearch → React components
```

## Types (`src/types/research.ts`)

```typescript
type LinkSource = 'grokipedia' | 'wikipedia' | 'curated'
interface ResearchLink { title, url, source: LinkSource, description }
interface MarkerResearch { markerNumber, generatedAt, links: ResearchLink[] }
interface ResearchManifest { version, generatedAt, markers: string[] }
```

## Component Contracts

### `LearnMoreSection` (`src/components/LearnMoreSection.tsx`)
- **Props**: `markerNumber: string`
- **Behavior**: Internally calls `useMarkerResearch(markerNumber)`. Returns null if no research. Renders collapsible section with `LearnMoreLink` cards.

### `LearnMoreLink` (`src/components/LearnMoreLink.tsx`)
- **Props**: `link: ResearchLink`
- **Behavior**: Renders anchor card with source badge, title, description. Opens in new tab.

### `useMarkerResearch` (`src/hooks/useMarkerResearch.ts`)
- **Input**: `markerNumber: string`
- **Output**: `{ research: MarkerResearch | null, loading: boolean, error: string | null }`
- **Behavior**: Fetches manifest (cached), checks if marker has data, fetches `.md`, runs projector.

## Integration Point
`MarkerDetail.tsx` — add `<LearnMoreSection>` between inscription div and actions div.

## Service Worker
New route in `src/sw.ts`: `StaleWhileRevalidate` for `/data/research/` paths, 30-day TTL, max 500 entries.

## Research Skill (out of repository)
The files below belong to the private agent tooling and are not in this public repository. The public repo keeps only `scripts/research-markdown.ts` (`generateResearchMarkdown`), used by the round-trip test.

`scripts/skills/marker-researcher.ts` — backing script with `buildSearchQueries`, `parseMarkerRange`, `generateResearchMarkdown`, `saveResearchMarkdown`, `updateManifest`.
`.claude/commands/research-marker.md` — Claude Code command definition.
