import { useState, useEffect } from 'react';
import type { Marker } from '../types/marker';
import type { MarkerResearch } from '../types/research';
import { fetchManifest } from './useMarkerResearch';
import { projectResearch } from '../projectors/researchProjector';
import { db } from '../db/database';

export interface FeaturedMarker {
  marker: Marker;
  research: MarkerResearch;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function useFeaturedMarkers(count = 3): {
  featured: FeaturedMarker[];
  loading: boolean;
} {
  const [featured, setFeatured] = useState<FeaturedMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const manifest = await fetchManifest();
        if (cancelled || !manifest || manifest.markers.length === 0) {
          setLoading(false);
          return;
        }

        const selected = shuffle(manifest.markers).slice(0, count);
        const results: FeaturedMarker[] = [];

        for (const num of selected) {
          if (cancelled) return;

          const [marker, resp] = await Promise.all([
            db.markers.where('markerNumber').equals(num).first(),
            fetch(`/data/research/${num}.md`),
          ]);

          if (!marker || !resp.ok) continue;

          const text = await resp.text();
          const research = projectResearch(text);
          if (!research) continue;

          results.push({ marker, research });
        }

        if (!cancelled) {
          setFeatured(results);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFeatured([]);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [count]);

  return { featured, loading };
}
