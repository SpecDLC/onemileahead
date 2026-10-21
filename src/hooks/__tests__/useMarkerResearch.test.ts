import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMarkerResearch, fetchManifest, _resetManifestCache } from '../useMarkerResearch';

const MANIFEST = {
  version: 1,
  generatedAt: '2026-02-28',
  markers: ['95', '100'],
};

const RESEARCH_MD = `---
markerNumber: "95"
generatedAt: "2026-02-28"
---

## Grokipedia

- [Battle of the Alamo](https://grokipedia.com/article/Battle_of_the_Alamo)
  The Alamo mission in San Antonio was the site of the pivotal 1836 battle.
`;

beforeEach(() => {
  _resetManifestCache();
  vi.restoreAllMocks();
});

describe('useMarkerResearch', () => {
  it('returns null when manifest does not include marker number', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MANIFEST), { status: 200 }),
    );

    const { result } = renderHook(() => useMarkerResearch('999'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.research).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns MarkerResearch when data available', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MANIFEST), { status: 200 }))
      .mockResolvedValueOnce(new Response(RESEARCH_MD, { status: 200 }));

    const { result } = renderHook(() => useMarkerResearch('95'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.research).not.toBeNull();
    expect(result.current.research!.markerNumber).toBe('95');
    expect(result.current.research!.links).toHaveLength(1);
    expect(result.current.research!.links[0].source).toBe('grokipedia');
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMarkerResearch('95'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.research).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('caches manifest after first fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MANIFEST), { status: 200 }))
      .mockResolvedValueOnce(new Response(RESEARCH_MD, { status: 200 }))
      .mockResolvedValueOnce(new Response(RESEARCH_MD, { status: 200 }));

    const { result: result1 } = renderHook(() => useMarkerResearch('95'));
    await waitFor(() => expect(result1.current.loading).toBe(false));

    const { result: result2 } = renderHook(() => useMarkerResearch('100'));
    await waitFor(() => expect(result2.current.loading).toBe(false));

    // Manifest fetched once, research files fetched twice
    const manifestCalls = fetchSpy.mock.calls.filter(
      (call) => (call[0] as string).includes('manifest.json'),
    );
    expect(manifestCalls).toHaveLength(1);
  });

  it('shows loading state while fetching', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((resolve) => setTimeout(
        () => resolve(new Response(JSON.stringify(MANIFEST), { status: 200 })),
        100,
      )),
    );

    const { result } = renderHook(() => useMarkerResearch('95'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles manifest fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const { result } = renderHook(() => useMarkerResearch('95'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.research).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it('fetches the manifest again after a failed attempt [AC:OMA-FUNC-LEARN-3]', async () => {
    // First attempt: offline. Second attempt: the network is back.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify(MANIFEST), { status: 200 }));

    await expect(fetchManifest()).rejects.toThrow('Failed to fetch');
    await expect(fetchManifest()).resolves.toEqual(MANIFEST);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
