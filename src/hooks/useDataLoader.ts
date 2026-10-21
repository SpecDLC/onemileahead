import { useState, useEffect } from 'react';
import { isSeeded, seedDatabase } from '../db/seed';
import type { Marker } from '../types/marker';

export type LoadState = 'checking' | 'downloading' | 'seeding' | 'ready' | 'error';

async function fetchMarkerData(): Promise<Marker[]> {
  // Try plain JSON first (works reliably across all servers)
  try {
    const resp = await fetch('/data/markers.json');
    if (resp.ok) return await resp.json();
  } catch { /* fall through to gzip */ }

  // Fallback: try gzipped version with manual decompression
  try {
    const resp = await fetch('/data/markers.json.gz');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const clone = resp.clone();

    // Server may transparently decompress — try json() first
    try {
      return await resp.json();
    } catch {
      const ds = new DecompressionStream('gzip');
      const decompressed = clone.body!.pipeThrough(ds);
      return await new Response(decompressed).json();
    }
  } catch (e) {
    throw new Error(`Failed to load marker data: ${e instanceof Error ? e.message : e}`);
  }
}

export function useDataLoader() {
  const [state, setState] = useState<LoadState>('checking');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (await isSeeded()) {
          if (!cancelled) setState('ready');
          return;
        }

        if (!cancelled) setState('downloading');
        const markers = await fetchMarkerData();

        if (!cancelled) setState('seeding');
        await seedDatabase(markers, {
          onProgress: (pct) => {
            if (!cancelled) setProgress(pct);
          },
        });

        if (!cancelled) setState('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setState('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { state, progress, error };
}
