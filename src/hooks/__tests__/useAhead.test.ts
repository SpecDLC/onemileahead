import { describe, it, expect } from 'vitest';
import { nextCues } from '../useAhead';
import type { AheadItem, AheadResult } from '../../engine';
import type { Marker } from '../../types/marker';

function item(id: number, title: string, along_mi = 0.9): AheadItem {
  const marker = { id, markerNumber: String(id), title, lat: 31, lng: -97.5 } as Marker;
  return { marker, along_mi, cross_ft: 300, side: 'right', eta_s: 60 };
}

function result(status: AheadResult['status'], results: AheadItem[], cues: AheadItem[] = []): AheadResult {
  return { status, heading: status === 'ok' ? 0 : null, speed_mps: status === 'ok' ? 25 : null, results, cues };
}

describe('nextCues', () => {
  it('keeps a cue through a stationary fix, so it is still shown when moving again (review blocker 2)', () => {
    const roadside = item(1, 'Roadside');
    let held = nextCues([], result('ok', [roadside], [roadside]));
    expect(held.map((c) => c.marker.title)).toEqual(['Roadside']);

    held = nextCues(held, result('stationary', []));
    expect(held.map((c) => c.marker.title)).toEqual(['Roadside']);

    // Moving again: the engine does not re-fire the cue, but the marker is still ahead.
    held = nextCues(held, result('ok', [item(1, 'Roadside', 0.8)]));
    expect(held.map((c) => c.marker.title)).toEqual(['Roadside']);
    expect(held[0].along_mi).toBe(0.8);
  });

  it.each(['no_heading', 'no_speed', 'gps_jump', 'no_fixes'] as const)('keeps cues on a %s fix', (status) => {
    const a = item(1, 'A');
    expect(nextCues([a], result(status, []))).toEqual([a]);
  });

  it('drops a cue once a usable fix no longer has that marker ahead', () => {
    const a = item(1, 'A');
    expect(nextCues([a], result('ok', [item(2, 'B', 3)]))).toEqual([]);
  });

  it('shows every cue fired on the same fix, not only the last (review should-fix 6)', () => {
    const alpha = item(1, 'Alpha', 0.9);
    const beta = item(2, 'Beta', 0.95);
    const held = nextCues([], result('ok', [alpha, beta], [alpha, beta]));
    expect(held.map((c) => c.marker.title)).toEqual(['Alpha', 'Beta']);
  });

  it('does not duplicate a marker that cues again after re-arming', () => {
    const a = item(1, 'A');
    expect(nextCues([a], result('ok', [a], [a]))).toEqual([a]);
  });
});
