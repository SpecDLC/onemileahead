/**
 * App entry to the WASM engine.
 *
 * Ahead loads it on the plain URL. Nearby calls `getEngine()` only when `?engine=wasm` is set,
 * and otherwise keeps the TypeScript scan.
 *
 * `getEngine()` resolves to a loaded engine, or `null` if anything fails (fetch, instantiate,
 * load). Callers fall back to the TypeScript path on `null`.
 */
import wasmUrl from './oma_engine.wasm?url';
import { db } from '../db/database';
import { OmaEngine } from './omaEngine';

export { OmaEngine } from './omaEngine';
export type { AheadItem, AheadResult, AheadOptions, EngineNearby, Fix } from './omaEngine';

export { isWasmEngineEnabled } from './flag';

let enginePromise: Promise<OmaEngine | null> | null = null;

/** Cache name the service worker serves *.wasm from (src/sw.ts). */
export const ENGINE_CACHE = 'engine-wasm';

/**
 * Store the engine module in the service worker's cache as soon as the page loads, so Ahead can
 * load it on the plain URL, including offline, even if that tab was never opened while online.
 * Writes the cache directly rather than fetching through the service worker, because on the first
 * visit the page isn't controlled yet. Never rejects; a no-op without Cache Storage.
 */
export async function warmEngineCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(ENGINE_CACHE);
    if (!(await cache.match(wasmUrl))) await cache.add(wasmUrl);
  } catch (err) {
    console.warn('[engine] could not cache the engine for offline use:', err);
  }
}

async function fetchBytes(): Promise<ArrayBuffer> {
  const res = await fetch(wasmUrl);
  if (!res.ok) throw new Error(`engine fetch failed: HTTP ${res.status}`);
  return res.arrayBuffer();
}

/** Load once per page. Never rejects. Ahead calls this on the plain URL. */
export function getEngine(
  loadBytes: () => Promise<BufferSource> = fetchBytes,
): Promise<OmaEngine | null> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        const engine = await OmaEngine.fromBytes(await loadBytes());
        // Search stays on Fuse. Nearby uses this engine only behind ?engine=wasm.
        engine.load(await db.markers.toArray(), { lazyText: true });
        return engine;
      } catch (err) {
        console.warn('[engine] WASM engine unavailable, using the TypeScript path:', err);
        return null;
      }
    })();
  }
  return enginePromise;
}

/** Test hook: forget the cached engine. */
export function resetEngineForTests(): void {
  enginePromise = null;
}
