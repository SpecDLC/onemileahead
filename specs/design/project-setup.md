# Design: Project Setup

## ID: project-setup

## Tech Stack
- **React 19** + TypeScript (strict mode)
- **Vite 7** with `@vitejs/plugin-react` and `vite-plugin-pwa`
- **Vitest 4** with jsdom, React Testing Library, fake-indexeddb
- **Playwright** for E2E testing
- **Workbox** for service worker (injectManifest)

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Build config, React plugin, PWA plugin with manifest |
| `vitest.config.ts` | Test runner config, jsdom env, setup file, coverage |
| `tsconfig.json` | TypeScript strict config, DOM + WebWorker libs |
| `tsconfig.node.json` | Node-side TS config for config files |
| `playwright.config.ts` | E2E config, Chromium + Mobile Chrome projects |
| `.gitignore` | Ignores node_modules, dist, data/, coverage |

## Data Sources

### THC Shapefile
- URL: `https://atlas.thc.texas.gov/staticFile/HistoricalMarkers_shp.zip`
- Contains: lat/lng coordinates, marker number, name
- Missing: inscription text, county, city, subject codes

### THC CSV (via API)
- Endpoint: `POST /Data/GetDataDownloadByCountyAndCollection`
- Contains: full inscription text, all metadata (23 columns)
- Missing: lat/lng (has UTM coordinates, 79% coverage)

### Data pipeline strategy
Merge both sources: CSV provides metadata, shapefile provides lat/lng coordinates.
Join on MarkerNum/Atlas_Number fields.

## Directory Layout
See plan file for full structure.

## Status: COMPLETE
