import { useState, useEffect, useRef } from 'react';
import type { Marker } from '../types/marker';
import { searchByMarkerNumber } from '../search/markerNumberSearch';
import { SearchEngine } from '../search/searchEngine';
import { db } from '../db/database';

const DEBOUNCE_MS = 150;
const NO_RESULTS: Marker[] = [];

/**
 * Marker-number lookup for a pure number, `#95`, or `marker 95` (optional hash, any case).
 * Anything else, including a number buried in a keyword query, stays a text search.
 * Returns the digits to look up, or null.
 */
export function markerNumberLookup(query: string): string | null {
  const trimmed = query.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const hashed = /^#\s*(\d+)$/.exec(trimmed);
  if (hashed) return hashed[1];
  const labeled = /^marker\s+#?\s*(\d+)$/i.exec(trimmed);
  if (labeled) return labeled[1];
  return null;
}

interface Completed {
  query: string;
  results: Marker[];
}

/**
 * Results for the current query. A pure number, `#95`, or `marker 95` uses the marker-number
 * index. Every other query uses keyword search. While a new search runs, the previous results stay
 * on screen and `isLoading` is true; an empty query clears them.
 *
 * State only changes when a search completes. Loading is derived (the last completed query isn't
 * the current one), so the effect never sets state synchronously.
 */
export function useMarkerSearch(query: string) {
  const trimmed = query.trim();
  const [completed, setCompleted] = useState<Completed>({ query: '', results: NO_RESULTS });
  const engineRef = useRef<SearchEngine | null>(null);

  // Clearing the box drops the old results, so they don't reappear while the next search runs.
  // (Adjusting state during render, as React recommends for resetting on a prop change.)
  if (!trimmed && completed.results !== NO_RESULTS) {
    setCompleted({ query: '', results: NO_RESULTS });
  }

  useEffect(() => {
    if (!trimmed) return;

    // Set when the query changes, so a slower search for an earlier query
    // can't overwrite the results for the current one [OMA-FUNC-LOOKUP-4].
    let cancelled = false;

    const timer = setTimeout(async () => {
      let hits = NO_RESULTS;
      try {
        const number = markerNumberLookup(trimmed);
        if (number !== null) {
          hits = await searchByMarkerNumber(number);
        } else {
          if (!engineRef.current) {
            const allMarkers = await db.markers.toArray();
            engineRef.current = new SearchEngine(allMarkers);
          }
          hits = engineRef.current.search(trimmed);
        }
      } finally {
        if (!cancelled) setCompleted({ query: trimmed, results: hits });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  if (!trimmed) return { results: NO_RESULTS, isLoading: false };
  return { results: completed.results, isLoading: completed.query !== trimmed };
}
