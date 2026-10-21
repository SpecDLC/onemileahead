# Requirements: Project Setup

## ID: project-setup

## Description
Initialize the One Mile Ahead PWA project with React 19, TypeScript, Vite, and all supporting tooling.

*Revised 2026-10-21 to match the repository at f02f48c (spec-drift cleanup from the launch audit). Items that never existed in this public repository are marked as such rather than ticked.*

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
- [x] `src/` with components, pages, db, search, hooks, utils, types, styles, engine (WASM wrapper) and projectors. The map is `src/pages/MapPage.tsx`; there is no `src/map/`
- [x] `crates/` for the Rust engine (`oma-core`, `oma-wasm`)
- [x] `specs/` for SpecDLC artifacts
- [x] `public/data/` for built marker data (`markers.json` is committed)
- [x] `fixtures/` for test inputs
- [x] `e2e/` for Playwright tests
- Not in this repository: `scripts/skills/` and `.claude/commands/` (the agent tooling is kept private), and `data/` (raw THC sources). `.gitignore` no longer lists `data/`, so raw sources must be kept out by hand

### AC-PS-05: NPM scripts
- [x] `dev` — start dev server
- [x] `build` — typecheck + production build
- [x] `test` — run tests
- [x] `test:watch` — run tests in watch mode
- [x] `test:coverage` — run tests with coverage
- [x] `test:e2e` — run Playwright E2E tests
- [x] `typecheck` — TypeScript check only
- [x] `preview` — preview production build
- [x] `lint` — ESLint over `src/`
- [x] `deploy` — build, then `wrangler deploy`

### AC-PS-06: Data acquisition
- [x] THC shapefile downloaded (NAD83 / Texas State Mapping System points; see `requirements/data-pipeline.md`)
- [x] THC CSV downloaded via the Atlas data download (17,371 records in the 2026-10 export, 23 fields, inscription text)
- [x] API endpoint documented for future data refreshes (`design/project-setup.md`)

## Status: COMPLETE
