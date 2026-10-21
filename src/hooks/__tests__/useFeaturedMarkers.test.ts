import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeaturedMarkers } from '../useFeaturedMarkers';
import { _resetManifestCache } from '../useMarkerResearch';

const MOCK_MANIFEST = {
  version: 1,
  generatedAt: '2026-02-28',
  markers: ['1', '95', '322'],
};

const MOCK_RESEARCH_MD = `---
markerNumber: "95"
generatedAt: "2026-02-28"
---

## Grokipedia

- [Battle of the Alamo](https://grokipedia.com/article/Battle_of_the_Alamo)
  The Alamo was the site of the pivotal 1836 battle.

## Wikipedia

- [Alamo Cenotaph](https://en.wikipedia.org/wiki/Alamo_Cenotaph)
  This monument honors the fallen defenders.
`;

const MOCK_MARKER = {
  id: 42,
  markerNumber: '95',
  title: 'Alamo Cenotaph',
  county: 'Bexar',
  city: 'San Antonio',
  lat: 29.426,
  lng: -98.486,
  markerText: 'Historic monument',
  markerDate: '1940',
  subjectCodes: ['military'],
  isRTHL: true,
  size: '18" x 28"',
};

vi.mock('../../db/database', () => ({
  db: {
    markers: {
      where: () => ({
        equals: () => ({
          first: () => Promise.resolve(MOCK_MARKER),
        }),
      }),
    },
  },
}));

function mockFetch(url: string) {
  if (url.includes('manifest.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(MOCK_MANIFEST),
    });
  }
  if (url.endsWith('.md')) {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(MOCK_RESEARCH_MD),
    });
  }
  return Promise.resolve({ ok: false });
}

beforeEach(() => {
  _resetManifestCache();
  vi.restoreAllMocks();
  vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch as unknown as typeof fetch);
});

describe('useFeaturedMarkers', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useFeaturedMarkers());
    expect(result.current.loading).toBe(true);
    expect(result.current.featured).toEqual([]);
  });

  it('returns featured markers with research data', async () => {
    const { result } = renderHook(() => useFeaturedMarkers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.featured.length).toBeGreaterThan(0);
    expect(result.current.featured.length).toBeLessThanOrEqual(3);

    const first = result.current.featured[0];
    expect(first.marker).toBeDefined();
    expect(first.marker.title).toBeDefined();
    expect(first.research).toBeDefined();
    expect(first.research.links.length).toBeGreaterThan(0);
  });

  it('respects count parameter', async () => {
    const { result } = renderHook(() => useFeaturedMarkers(2));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.featured.length).toBeLessThanOrEqual(2);
  });

  it('handles manifest fetch failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFeaturedMarkers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.featured).toEqual([]);
  });

  it('skips markers not found in database', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
      if (url.includes('manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...MOCK_MANIFEST, markers: ['99999'] }),
        });
      }
      if (url.endsWith('.md')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_RESEARCH_MD),
        });
      }
      return Promise.resolve({ ok: false });
    }) as unknown as typeof fetch);

    // Override db mock for this test — marker not found
    const dbMod = await import('../../db/database');
    vi.spyOn(dbMod.db.markers, 'where').mockReturnValue({
      equals: () => ({
        first: () => Promise.resolve(undefined),
      }),
    } as never);

    const { result } = renderHook(() => useFeaturedMarkers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.featured).toEqual([]);
  });
});
