import { describe, it, expect } from 'vitest';
import { texasMappingToLatLng, isInTexas } from '../texas-mapping';

// Kilometres between two nearby points (equirectangular is fine at this scale).
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const x = (a.lng - b.lng) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  const y = (a.lat - b.lat) * 110.57;
  return Math.hypot(x, y);
}

describe('THC shapefile coordinates (NAD83 / Texas State Mapping System) [AC:OMA-DATA-PIPE-2]', () => {
  // Raw shapefile geometry for these markers, as found in the 2026-02-28 markers.json.
  it('converts the Alamo Cenotaph (#95) to its location on Alamo Plaza', () => {
    const p = texasMappingToLatLng(1146593.6815425232, 808429.4970920198);
    expect(km(p, { lat: 29.4258, lng: -98.4861 })).toBeLessThan(0.2);
  });

  it('converts marker #1 to Seymour, Baylor County', () => {
    const p = texasMappingToLatLng(1068706.9865579829, 1268375.410224378);
    expect(km(p, { lat: 33.594, lng: -99.26 })).toBeLessThan(2);
  });
});

describe('isInTexas', () => {
  it('accepts points in Texas and rejects projected metres, 0,0 and neighbouring states', () => {
    expect(isInTexas(29.4258, -98.4861)).toBe(true);
    expect(isInTexas(1268375.41, 1068706.99)).toBe(false);
    expect(isInTexas(0, 0)).toBe(false);
    expect(isInTexas(33.571088, -90.208032)).toBe(false); // Mississippi
  });
});
