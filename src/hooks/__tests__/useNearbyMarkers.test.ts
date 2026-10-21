import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNearbyMarkers } from '../useNearbyMarkers';
import { db } from '../../db/database';
import type { Marker } from '../../types/marker';

function makeMarker(overrides: Partial<Marker> = {}): Marker {
  return {
    id: 1,
    markerNumber: '1234',
    title: 'Test Marker',
    county: 'Travis',
    city: 'Austin',
    lat: 30.2672,
    lng: -97.7431,
    markerText: 'A historical marker.',
    markerDate: '1970',
    subjectCodes: ['buildings'],
    isRTHL: false,
    size: '18" x 28"',
    ...overrides,
  };
}

describe('useNearbyMarkers [REQ:nearby]', () => {
  beforeEach(async () => {
    await db.markers.clear();
    await db.markers.bulkAdd([
      makeMarker({ id: 1, markerNumber: '100', title: 'Near Marker', lat: 30.268, lng: -97.744 }),  // ~0.05 mi
      makeMarker({ id: 2, markerNumber: '200', title: 'Far Marker', lat: 31.0, lng: -97.0 }),       // ~60 mi
      makeMarker({ id: 3, markerNumber: '300', title: 'Medium Marker', lat: 30.3, lng: -97.7 }),    // ~2.5 mi
      makeMarker({ id: 4, markerNumber: '400', title: 'No Coords', lat: 0, lng: 0 }),               // no coords
    ]);
  });

  it('returns empty when no position provided [AC:NEAR-01]', () => {
    const { result } = renderHook(() => useNearbyMarkers(null));
    expect(result.current.markers).toHaveLength(0);
  });

  it('returns markers sorted by distance [AC:NEAR-02]', async () => {
    const { result } = renderHook(() =>
      useNearbyMarkers({ lat: 30.2672, lng: -97.7431 }),
    );

    // Wait for async load
    await vi.waitFor(() => {
      expect(result.current.markers.length).toBeGreaterThan(0);
    });

    // Should be sorted: Near, Medium, Far
    expect(result.current.markers[0].marker.title).toBe('Near Marker');
    expect(result.current.markers[1].marker.title).toBe('Medium Marker');
    expect(result.current.markers[2].marker.title).toBe('Far Marker');
  });

  it('includes distance for each marker [AC:NEAR-03]', async () => {
    const { result } = renderHook(() =>
      useNearbyMarkers({ lat: 30.2672, lng: -97.7431 }),
    );

    await vi.waitFor(() => {
      expect(result.current.markers.length).toBeGreaterThan(0);
    });

    expect(result.current.markers[0].distance).toBeGreaterThan(0);
    expect(result.current.markers[0].distance).toBeLessThan(1); // very close
  });

  it('excludes markers with zero coordinates [AC:NEAR-04]', async () => {
    const { result } = renderHook(() =>
      useNearbyMarkers({ lat: 30.2672, lng: -97.7431 }),
    );

    await vi.waitFor(() => {
      expect(result.current.markers.length).toBeGreaterThan(0);
    });

    const titles = result.current.markers.map((m) => m.marker.title);
    expect(titles).not.toContain('No Coords');
  });

  it('respects limit parameter [AC:NEAR-05]', async () => {
    const { result } = renderHook(() =>
      useNearbyMarkers({ lat: 30.2672, lng: -97.7431 }, 2),
    );

    await vi.waitFor(() => {
      expect(result.current.markers.length).toBe(2);
    });
  });
});
