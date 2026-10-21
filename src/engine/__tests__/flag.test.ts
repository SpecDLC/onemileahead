/// <reference types="node" />
/**
 * ?engine=wasm integration: the flag, loading, and the fall-back to the TypeScript path
 * [REQ:wasm-engine AC-WE-10].
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderHook, waitFor } from '@testing-library/react';
import * as engineApi from '..';
import { getEngine, isWasmEngineEnabled, resetEngineForTests } from '..';
import { useNearbyMarkers, computeNearby } from '../../hooks/useNearbyMarkers';
import { db } from '../../db/database';
import type { Marker } from '../../types/marker';

const ROOT = join(__dirname, '..', '..', '..');
const WASM = readFileSync(join(ROOT, 'src', 'engine', 'oma_engine.wasm'));
const FIXTURE: Marker[] = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'i35-austin-waco.json'), 'utf8')).markers;

function setSearch(s: string) {
  window.history.replaceState({}, '', `/${s}`);
}

beforeEach(async () => {
  resetEngineForTests();
  await db.delete();
  await db.open();
  await db.markers.bulkAdd(FIXTURE);
});

afterEach(() => {
  setSearch('');
  vi.restoreAllMocks();
});

describe('engine flag', () => {
  it('is off by default and on with ?engine=wasm', () => {
    expect(isWasmEngineEnabled('')).toBe(false);
    expect(isWasmEngineEnabled('?engine=ts')).toBe(false);
    expect(isWasmEngineEnabled('?engine=wasm')).toBe(true);
    expect(isWasmEngineEnabled('?x=1&engine=wasm')).toBe(true);
  });

  it('loads the engine when the query string is empty', async () => {
    setSearch('');
    const loader = vi.fn(async () => WASM);
    const engine = await getEngine(loader);
    expect(loader).toHaveBeenCalledOnce();
    expect(engine).not.toBeNull();
    expect(engine!.lookup(FIXTURE[0].markerNumber, 1)[0].id).toBe(FIXTURE[0].id);
  });

  it('loads the markers from IndexedDB when the flag is on', async () => {
    setSearch('?engine=wasm');
    const engine = await getEngine(async () => WASM);
    expect(engine).not.toBeNull();
    expect(engine!.lookup(FIXTURE[0].markerNumber, 1)[0].id).toBe(FIXTURE[0].id);
  });

  it('falls back (null + warning) when the module is broken', async () => {
    setSearch('?engine=wasm');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await getEngine(async () => new Uint8Array([0, 1, 2, 3]))).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('useNearbyMarkers with ?engine=wasm', () => {
  it('uses the TypeScript scan when the flag is absent', async () => {
    setSearch('');
    const spy = vi.spyOn(engineApi, 'getEngine');
    const pos = { lat: 30.6327, lng: -97.6779 }; // Georgetown
    const { result } = renderHook(() => useNearbyMarkers(pos, 10));
    await waitFor(() => expect(result.current.markers).toHaveLength(10));
    const ts = computeNearby(await db.markers.toArray(), pos, 10);
    expect(result.current.markers.map((m) => m.marker.id)).toEqual(ts.map((m) => m.marker.id));
    expect(spy).not.toHaveBeenCalled();
  });

  it('routes through the engine and returns what the TS path returns', async () => {
    setSearch('?engine=wasm');
    await getEngine(async () => WASM); // warm the singleton with the test bytes
    const pos = { lat: 30.6327, lng: -97.6779 }; // Georgetown
    const { result } = renderHook(() => useNearbyMarkers(pos, 10));
    await waitFor(() => expect(result.current.markers).toHaveLength(10));
    const ts = computeNearby(await db.markers.toArray(), pos, 10);
    expect(result.current.markers.map((m) => m.marker.id)).toEqual(ts.map((m) => m.marker.id));
  });

  it('falls back to the TypeScript scan when the engine fails to load', async () => {
    setSearch('?engine=wasm');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await getEngine(async () => new Uint8Array([0])); // broken module cached as null
    const pos = { lat: 31.5493, lng: -97.1467 }; // Waco
    const { result } = renderHook(() => useNearbyMarkers(pos, 5));
    await waitFor(() => expect(result.current.markers).toHaveLength(5));
    const ts = computeNearby(await db.markers.toArray(), pos, 5);
    expect(result.current.markers.map((m) => m.marker.id)).toEqual(ts.map((m) => m.marker.id));
  });
});

describe('useAhead (Ahead tab) with an empty query string', () => {
  it('cues one corridor marker once on a straight-line highway replay', async () => {
    setSearch('');
    const engine = await getEngine(async () => WASM);
    engine!.resetCues();
    const target = FIXTURE.find((m) => m.markerNumber && (m.lat !== 0 || m.lng !== 0))!;
    const step = 30 / 1609.344 / 69.0; // degrees of latitude per second at 30 m/s
    const window = 30;
    const fixes: { lat: number; lng: number; t: number; heading: number; speed: number }[] = [];
    const fires = new Map<number, number>();
    let firstAlong = Infinity;
    for (let i = 0; i <= 160; i++) {
      fixes.push({
        lat: target.lat - 1.5 / 69.0 + i * step,
        lng: target.lng,
        t: i * 1000,
        heading: 0,
        speed: 30,
      });
      const result = engine!.ahead(fixes.slice(-window), { horizon_mi: 10 });
      for (const cue of result.cues) {
        fires.set(cue.marker.id, (fires.get(cue.marker.id) ?? 0) + 1);
        if (cue.marker.id === target.id) firstAlong = Math.min(firstAlong, cue.along_mi);
      }
    }
    expect(fires.get(target.id)).toBe(1);
    expect(firstAlong).toBeLessThanOrEqual(1);
    expect(firstAlong).toBeGreaterThan(0);
    for (const count of fires.values()) expect(count).toBe(1);

    const { useAhead } = await import('../../hooks/useAhead');
    engine!.resetCues();
    let pos = { lat: target.lat - 1.5 / 69.0, lng: target.lng, heading: 0, speed: 30, timestamp: 0 };
    const { result, rerender } = renderHook(({ p }) => useAhead(p), { initialProps: { p: pos } });
    await waitFor(() => expect(result.current.available).toBe(true));
    for (let i = 1; i <= 120 && result.current.cues.length === 0; i++) {
      pos = { ...pos, lat: pos.lat + step, timestamp: i * 1000 };
      rerender({ p: pos });
      await waitFor(() => expect(result.current.result).not.toBeNull());
    }
    expect(result.current.result!.status).toBe('ok');
    expect(result.current.cues.map((c) => c.marker.id)).toContain(target.id);
    expect(result.current.cues.find((c) => c.marker.id === target.id)!.along_mi).toBeLessThanOrEqual(1);
  });
});
