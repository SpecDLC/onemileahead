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
| `.gitignore` | Ignores node_modules, dist, target, coverage, .wrangler, test output and `.env*`. It no longer ignores `data/`; raw THC sources are kept out of the repo by hand |
| `eslint.config.js` | Flat config: typescript-eslint recommended + react-hooks |
| `wrangler.jsonc` | Cloudflare Workers static-assets deploy (no Worker script) |

## Data Sources

### THC Shapefile
- URL: `https://atlas.thc.texas.gov/staticFile/HistoricalMarkers_shp.zip`
- Contains: point coordinates in NAD83 / Texas State Mapping System (EPSG:3081) metres, marker number, name. The pipeline reprojects them to WGS84 latitude/longitude
- Missing: inscription text, county, city, subject codes

### THC CSV (via API)
- Endpoint: `POST /Data/GetDataDownloadByCountyAndCollection`
- Contains: full inscription text, all metadata (23 columns)
- Missing: lat/lng (has UTM coordinates, 79% coverage)

### Data pipeline strategy
Merge both sources: CSV provides metadata, shapefile provides coordinates (reprojected), and CSV UTM is the fallback.
Join on `MarkerNum`. Details in `requirements/data-pipeline.md`.

## Directory Layout
See the README's Layout section and `requirements/project-setup.md` AC-PS-04. (This section used to point at a plan file that is not in the repository.)

## Status: COMPLETE
