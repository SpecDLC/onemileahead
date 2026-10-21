import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { haversineDistance, bearing } from '../utils/distance';
import { getEngine, isWasmEngineEnabled } from '../engine';
import type { Marker } from '../types/marker';
import type { GeoPosition } from './useGeolocation';

export interface NearbyMarker {
  marker: Marker;
  distance: number;  // miles
  bearing: number;   // degrees
}

/**
 * The TypeScript nearby computation: full scan, nearest first. `allMarkers` must be in
 * primary-key order (what `db.markers.toArray()` returns) for ties to resolve the same way.
 */
export function computeNearby(
  allMarkers: Marker[],
  position: Pick<GeoPosition, 'lat' | 'lng'>,
  limit: number,
): NearbyMarker[] {
  return allMarkers
    .filter((m) => m.lat !== 0 || m.lng !== 0)
    .map((m) => ({
      marker: m,
      distance: haversineDistance(position.lat, position.lng, m.lat, m.lng),
      bearing: bearing(position.lat, position.lng, m.lat, m.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

const NONE: NearbyMarker[] = [];

interface Completed {
  key: string;
  markers: NearbyMarker[];
}

/**
 * The `limit` nearest markers to `position`. While a new position is computed, the previous list
 * stays on screen and `isLoading` is true; no position means an empty list.
 *
 * State only changes when a computation completes. Loading is derived (the last completed
 * position isn't the current one), so the effect never sets state synchronously.
 */
export function useNearbyMarkers(
  position: GeoPosition | null,
  limit = 50,
) {
  const lat = position?.lat;
  const lng = position?.lng;
  const key = lat === undefined || lng === undefined ? '' : `${lat},${lng},${limit}`;
  const [completed, setCompleted] = useState<Completed>({ key: '', markers: NONE });

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;

    let cancelled = false;

    (async () => {
      // ?engine=wasm: indexed lookup in the Rust engine; falls back to the scan below.
      const engine = isWasmEngineEnabled() ? await getEngine() : null;
      let withDistance: NearbyMarker[] | null = null;
      if (engine) {
        try {
          withDistance = engine.nearby(lat, lng, limit);
        } catch (err) {
          console.warn('[engine] nearby failed, using the TypeScript path:', err);
        }
      }
      withDistance ??= computeNearby(await db.markers.toArray(), { lat, lng }, limit);

      if (!cancelled) {
        setCompleted({ key: `${lat},${lng},${limit}`, markers: withDistance });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, limit]);

  if (!key) return { markers: NONE, isLoading: false };
  return { markers: completed.markers, isLoading: completed.key !== key };
}
