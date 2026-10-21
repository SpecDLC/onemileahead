# Requirements: Learn More Feature

## Overview
The Learn More feature adds a section to the Marker Detail page that displays curated external links related to each historical marker. Links come from Grokipedia (primary), Wikipedia (fallback), and curated sources. Research data is authored as Markdown files and parsed at runtime by TypeScript projectors.

**Status 2026-10-21:** no research files ship yet (`public/data/research/` is not in the repository). By owner decision (Q4 in `acceptance/one-mile-ahead-launch-audit.md`), Learn More and featured markers are hidden until they do, and `OMA-FUNC-LEARN-1`–`4`, `OMA-FUNC-FEAT-1` and `OMA-TECH-EDGE-5` are retired until then. The requirements below describe the feature for when research ships.

## User Stories

- **US-LM-01**: As a passenger, I want to see related articles about a historical marker so I can learn more about the topic beyond the inscription.
- **US-LM-02**: As a developer, I want to generate research data via a Claude Code command so I can efficiently curate links for markers.
- **US-LM-03**: As a user, I want researched links to be cached for offline viewing so I can access them without connectivity.

## Acceptance Criteria

### Learn More Section (AC-LM-01 through AC-LM-06)
- **AC-LM-01**: Marker detail page shows a "Learn More" section when research data exists for that marker.
- **AC-LM-02**: Section is absent (not empty) when no research data exists for a marker.
- **AC-LM-03**: Each link shows title, source badge (Grokipedia/Wikipedia/Related), and a 1-2 sentence description connecting it to the marker.
- **AC-LM-04**: Tapping a link opens it in a new browser tab.
- **AC-LM-05**: The section is collapsible (starts expanded, tap header to collapse).
- **AC-LM-06**: Links meet 48px minimum touch target.

### Data Format (AC-LM-07 through AC-LM-10)
- **AC-LM-07**: Research data is stored as standard Markdown files with YAML frontmatter.
- **AC-LM-08**: A manifest.json file lists all markers that have research data.
- **AC-LM-09**: TypeScript projectors parse Markdown into typed data — Markdown contains no HTML or presentation logic.
- **AC-LM-10**: The projector round-trips correctly: `projectResearch(generateResearchMarkdown(data))` matches original data.

### Caching (AC-LM-11 through AC-LM-12)
- **AC-LM-11**: Service worker caches fetched research Markdown files for offline access.
- **AC-LM-12**: Cache expires after 30 days with max 500 entries.

### Research Skill (AC-LM-13 through AC-LM-15) — out of repository
The command and its backing script are part of the private agent tooling and are not in this public repository. These ACs cannot be checked from here.
- **AC-LM-13**: `/research-marker` Claude Code command accepts marker number(s) as argument.
- **AC-LM-14**: Command generates research Markdown with Grokipedia, Wikipedia, and curated links.
- **AC-LM-15**: Command updates manifest.json after generating research files.
