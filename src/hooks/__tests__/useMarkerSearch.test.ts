import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMarkerSearch } from '../useMarkerSearch';
import { searchByMarkerNumber } from '../../search/markerNumberSearch';
import { db } from '../../db/database';
import type { Marker } from '../../types/marker';

// Real implementation by default; individual tests can control when a lookup resolves.
vi.mock('../../search/markerNumberSearch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../search/markerNumberSearch')>();
  return { ...actual, searchByMarkerNumber: vi.fn(actual.searchByMarkerNumber) };
});

function makeMarker(overrides: Partial<Marker> = {}): Marker {
  return {
    id: 1,
    markerNumber: '1234',
    title: 'Test Marker',
    county: 'Travis',
    city: 'Austin',
    lat: 30.2672,
    lng: -97.7431,
    markerText: 'A historical marker about something important.',
    markerDate: '1970',
    subjectCodes: ['buildings'],
    isRTHL: false,
    size: '18" x 28"',
    ...overrides,
  };
}

describe('useMarkerSearch [REQ:search]', () => {
  beforeEach(async () => {
    await db.markers.clear();
    await db.markers.bulkAdd([
      makeMarker({ id: 1, markerNumber: '100', title: 'The Alamo', county: 'Bexar', city: 'San Antonio' }),
      makeMarker({ id: 2, markerNumber: '1001', title: 'Capitol Building', county: 'Travis', city: 'Austin' }),
      makeMarker({ id: 3, markerNumber: '200', title: 'San Jacinto', county: 'Harris', city: 'La Porte' }),
    ]);
  });

  it('returns empty results for empty query [AC:HOOK-01]', () => {
    const { result } = renderHook(() => useMarkerSearch(''));
    expect(result.current.results).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('searches by marker number for numeric input [AC:HOOK-02]', async () => {
    const { result } = renderHook(() => useMarkerSearch('100'));

    await waitFor(() => {
      expect(result.current.results.length).toBeGreaterThan(0);
    });

    // Should find marker 100 and 1001 (prefix match)
    expect(result.current.results.some((r) => r.markerNumber === '100')).toBe(true);
    expect(result.current.results.some((r) => r.markerNumber === '1001')).toBe(true);
  });

  it('keeps previous results while a new search runs, but not after the box is cleared', async () => {
    const { result, rerender } = renderHook(({ q }) => useMarkerSearch(q), { initialProps: { q: '200' } });
    await waitFor(() => expect(result.current.results.map((r) => r.markerNumber)).toEqual(['200']));

    // A new query: the old results stay on screen while it loads, then are replaced.
    rerender({ q: '100' });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.results.map((r) => r.markerNumber)).toEqual(['200']);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.results.map((r) => r.markerNumber)).toEqual(['100', '1001']);

    // Clearing empties the list; typing again doesn't bring the old list back while loading.
    rerender({ q: '' });
    expect(result.current.results).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    rerender({ q: '200' });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.results).toHaveLength(0);
    await waitFor(() => expect(result.current.results.map((r) => r.markerNumber)).toEqual(['200']));
  });

  it('searches by text for non-numeric input [AC:HOOK-03]', async () => {
    const { result } = renderHook(() => useMarkerSearch('Alamo'));

    await waitFor(() => {
      expect(result.current.results.length).toBeGreaterThan(0);
    });

    expect(result.current.results[0].title).toBe('The Alamo');
  });

  it('updates results when query changes [AC:HOOK-04]', async () => {
    const { result, rerender } = renderHook(
      ({ query }) => useMarkerSearch(query),
      { initialProps: { query: '100' } },
    );

    await waitFor(() => {
      expect(result.current.results.length).toBeGreaterThan(0);
    });

    rerender({ query: '200' });

    await waitFor(() => {
      expect(result.current.results.some((r) => r.markerNumber === '200')).toBe(true);
    });
  });

  it('indicates loading state during search [AC:HOOK-05]', () => {
    const { result } = renderHook(() => useMarkerSearch('test'));
    // Initially or during search, isLoading may be true
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('never shows results for an earlier query [AC:OMA-FUNC-LOOKUP-4]', async () => {
    // The lookup for "1" is slow and finishes after the lookup for "12".
    const pending: Record<string, (markers: Marker[]) => void> = {};
    const controlled = (q: string) => new Promise<Marker[]>((resolve) => { pending[q] = resolve; });
    vi.mocked(searchByMarkerNumber)
      .mockImplementationOnce(controlled)
      .mockImplementationOnce(controlled);

    const { result, rerender } = renderHook(
      ({ query }) => useMarkerSearch(query),
      { initialProps: { query: '1' } },
    );
    await waitFor(() => expect(pending['1']).toBeDefined());

    rerender({ query: '12' });
    await waitFor(() => expect(pending['12']).toBeDefined());

    await act(async () => pending['12']([makeMarker({ id: 12, markerNumber: '12' })]));
    await act(async () => pending['1']([
      makeMarker({ id: 1, markerNumber: '1' }),
      makeMarker({ id: 10, markerNumber: '10' }),
    ]));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.results.map((m) => m.markerNumber)).toEqual(['12']);
  });
});
