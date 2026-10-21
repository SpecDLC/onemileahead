import { useState, useEffect } from 'react';
import type { MarkerResearch, ResearchManifest } from '../types/research';
import { projectResearch } from '../projectors/researchProjector';

let manifestCache: ResearchManifest | null = null;
let manifestPromise: Promise<ResearchManifest | null> | null = null;

export async function fetchManifest(): Promise<ResearchManifest | null> {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;

  const promise = (async () => {
    const resp = await fetch('/data/research/manifest.json');
    if (!resp.ok) throw new Error(`Manifest fetch failed: ${resp.status}`);
    const data = await resp.json();
    manifestCache = data as ResearchManifest;
    return manifestCache;
  })();
  manifestPromise = promise;

  // Don't keep a failure: the next caller retries, e.g. once the network is back.
  promise.catch(() => {
    if (manifestPromise === promise) manifestPromise = null;
  });

  return promise;
}

export function _resetManifestCache(): void {
  manifestCache = null;
  manifestPromise = null;
}

export function useMarkerResearch(markerNumber: string): {
  research: MarkerResearch | null;
  loading: boolean;
  error: string | null;
} {
  const [research, setResearch] = useState<MarkerResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const manifest = await fetchManifest();
        if (cancelled) return;

        if (!manifest || !manifest.markers.includes(markerNumber)) {
          setResearch(null);
          setLoading(false);
          return;
        }

        const resp = await fetch(`/data/research/${markerNumber}.md`);
        if (cancelled) return;

        if (!resp.ok) {
          setResearch(null);
          setLoading(false);
          return;
        }

        const text = await resp.text();
        if (cancelled) return;

        const parsed = projectResearch(text);
        setResearch(parsed);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setResearch(null);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [markerNumber]);

  return { research, loading, error };
}
