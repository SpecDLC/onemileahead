# Requirements: Project Setup

## ID: project-setup

## Description
Initialize the One Mile Ahead PWA project with React 19, TypeScript, Vite, and all supporting tooling.

## Acceptance Criteria

### AC-PS-01: Build tooling
- [x] Vite configured as build tool with React plugin
- [x] TypeScript strict mode enabled
- [x] Build produces production bundle with no errors
- [x] Dev server starts on `npm run dev`

### AC-PS-02: PWA configuration
- [x] vite-plugin-pwa configured with `injectManifest` strategy
- [x] Web app manifest with name, icons, theme color, display mode
- [x] Service worker TypeScript source at `src/sw.ts`
- [x] Service worker built and precache manifest injected

### AC-PS-03: Testing infrastructure
- [x] Vitest configured as test runner
- [x] jsdom environment for component tests
- [x] React Testing Library available for component testing
- [x] fake-indexeddb auto-shimmed in test setup
- [x] `@testing-library/jest-dom` matchers available
- [x] Coverage reporting via v8 provider
- [x] Playwright configured for E2E tests

### AC-PS-04: Project structure
- [x] `src/` directory with components, pages, db, search, map, hooks, utils, types, styles
- [x] `scripts/skills/` for skill backing scripts
- [x] `specs/` for SpecDLC artifacts
- [x] `.claude/commands/` for skill definitions
- [x] `public/data/` for built marker data
- [x] `data/` for raw source data (gitignored)
- [x] `e2e/` for Playwright tests

### AC-PS-05: NPM scripts
- [x] `dev` — start dev server
- [x] `build` — typecheck + production build
- [x] `test` — run tests
- [x] `test:watch` — run tests in watch mode
- [x] `test:coverage` — run tests with coverage
- [x] `test:e2e` — run Playwright E2E tests
- [x] `typecheck` — TypeScript check only
- [x] `preview` — preview production build

### AC-PS-06: Data acquisition
- [x] THC shapefile downloaded (16,123 features, 8 fields, lat/lng coordinates)
- [x] THC CSV downloaded via API (17,368 records, 23 fields, inscription text)
- [x] API endpoint documented for future data refreshes

## Status: COMPLETE
