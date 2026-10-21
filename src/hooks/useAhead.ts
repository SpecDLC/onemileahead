import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../engine';
import type { AheadItem, AheadResult, Fix } from '../engine';
import type { GeoPosition } from './useGeolocation';

const WINDOW = 30; // fixes kept for heading/speed estimation

export interface AheadState {
  /** null while loading; false if the engine is unavailable */
  available: boolean | null;
  result: AheadResult | null;
  /** "one mile ahead" cues still being shown, oldest first (the engine announces each once) */
  cues: AheadItem[];
}

/**
 * Which cues to keep showing after `result`. The engine fires each cue once, so a cue must not be
 * dropped just because a fix couldn't produce an ahead list (stopped, no heading, GPS jump): it is
 * dropped only when a usable (`ok`) result no longer has that marker ahead. Every cue fired on
 * this fix is added, not only the last.
 */
export function nextCues(held: AheadItem[], result: AheadResult): AheadItem[] {
  const fired = new Set(result.cues.map((c) => c.marker.id));
  let kept = held.filter((c) => !fired.has(c.marker.id));
  if (result.status === 'ok') {
    const ahead = new Map(result.results.map((r) => [r.marker.id, r]));
    // Refresh distance and side from the current fix; drop markers that are no longer ahead.
    kept = kept.flatMap((c) => {
      const now = ahead.get(c.marker.id);
      return now ? [now] : [];
    });
  }
  return [...kept, ...result.cues];
}

/** Feeds each GPS fix to the engine's `ahead` command. */
export function useAhead(position: GeoPosition | null): AheadState {
  const fixes = useRef<Fix[]>([]);
  const [state, setState] = useState<AheadState>({ available: null, result: null, cues: [] });

  useEffect(() => {
    let cancelled = false;
    getEngine().then((engine) => {
      if (!cancelled) setState((s) => ({ ...s, available: engine !== null }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!position) return;
    let cancelled = false;
    getEngine().then((engine) => {
      if (!engine || cancelled) return;
      fixes.current = [
        ...fixes.current,
        {
          lat: position.lat,
          lng: position.lng,
          t: position.timestamp ?? Date.now(),
          heading: position.heading ?? null,
          speed: position.speed ?? null,
        },
      ].slice(-WINDOW);
      try {
        // Corridor width and cue distance use the engine's defaults (specs/design/wasm-engine.md).
        const result = engine.ahead(fixes.current, { horizon_mi: 10 });
        setState((s) => ({ ...s, result, cues: nextCues(s.cues, result) }));
      } catch (err) {
        console.warn('[engine] ahead failed:', err);
      }
    });
    return () => {
      cancelled = true;
    };
    // useGeolocation creates a new position object for every fix, so this runs once per fix.
  }, [position]);

  return state;
}
