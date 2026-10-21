import { describe, it, expect } from 'vitest';
import { parseCSVToObjects } from '../csv-parser';
import { utmToLatLng } from '../utm-converter';
import { csvRowToMarker, mergeCoordinates, assertCoordinateCoverage } from '../prepare-data';
import type { Marker } from '../../src/types/marker';

describe('CSV parser [AC:DP-01]', () => {
  it('parses simple CSV', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6';
    const objs = parseCSVToObjects(csv);
    expect(objs).toHaveLength(2);
    expect(objs[0]).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('handles quoted fields with commas and newlines', () => {
    const csv = 'title,text\nHello,"A marker with, commas"\nWorld,"Line1\nLine2"';
    const objs = parseCSVToObjects(csv);
    expect(objs[0].text).toBe('A marker with, commas');
    expect(objs[1].text).toBe('Line1\nLine2');
  });

  it('handles escaped double quotes', () => {
    const csv = 'title\n"""Birthplace"" of County"';
    const objs = parseCSVToObjects(csv);
    expect(objs[0].title).toBe('"Birthplace" of County');
  });
});

describe('UTM to WGS84 conversion [AC:DP-08]', () => {
  it('converts Austin, TX UTM zone 14 to approx lat/lng', () => {
    // Austin, TX: UTM Zone 14, ~621000E, ~3350000N
    const result = utmToLatLng(621000, 3350000, 14, true);
    expect(result.lat).toBeCloseTo(30.28, 0); // ~30.28°N
    expect(result.lng).toBeCloseTo(-97.74, 0); // ~-97.74°W
  });

  it('converts El Paso, TX UTM zone 13 to approx lat/lng', () => {
    // El Paso, TX: UTM Zone 13, ~360000E, ~3520000N
    const result = utmToLatLng(360000, 3520000, 13, true);
    expect(result.lat).toBeCloseTo(31.8, 0);
    expect(result.lng).toBeCloseTo(-106.4, 0);
  });
});

describe('csvRowToMarker [AC:DP-04]', () => {
  it('transforms a CSV row to Marker schema', () => {
    const row = {
      MarkerNum: '1234',
      Atlas_Number: '5000001234',
      Title: 'Test Marker',
      City: 'Austin',
      County: 'Travis',
      Code: 'buildings; churches',
      Year: '1970',
      Rthl: 'True',
      Size: '18" x 28"',
      MarkerText: 'A historical inscription.',
      Utm_Zone: '14',
      Utm_East: '621000',
      Utm_North: '3350000',
    };

    const marker = csvRowToMarker(row, 1);

    expect(marker.id).toBe(1);
    expect(marker.markerNumber).toBe('1234');
    expect(marker.title).toBe('Test Marker');
    expect(marker.county).toBe('Travis');
    expect(marker.city).toBe('Austin');
    expect(marker.markerText).toBe('A historical inscription.');
    expect(marker.markerDate).toBe('1970');
    expect(marker.isRTHL).toBe(true);
    expect(marker.size).toBe('18" x 28"');
    expect(marker.subjectCodes).toEqual(['buildings', 'churches']);
  });

  it('parses semicolon-delimited subject codes [AC:DP-04]', () => {
    const row = {
      MarkerNum: '1',
      Title: 'T',
      City: '',
      County: '',
      Code: 'ranches/ranching; houses, residential buildings; counties',
      Year: '',
      Rthl: 'False',
      Size: '',
      MarkerText: '',
      Utm_Zone: '',
      Utm_East: '',
      Utm_North: '',
    };

    const marker = csvRowToMarker(row, 1);
    expect(marker.subjectCodes).toEqual([
      'ranches/ranching',
      'houses, residential buildings',
      'counties',
    ]);
  });

  it('handles RTHL false/empty values [AC:DP-04]', () => {
    const base = {
      MarkerNum: '1', Title: 'T', City: '', County: '', Code: '', Year: '',
      Rthl: 'False', Size: '', MarkerText: '', Utm_Zone: '', Utm_East: '', Utm_North: '',
    };
    expect(csvRowToMarker(base, 1).isRTHL).toBe(false);
    expect(csvRowToMarker({ ...base, Rthl: '' }, 1).isRTHL).toBe(false);
  });
});

describe('mergeCoordinates [AC:DP-03]', () => {
  it('uses shapefile coords when available', () => {
    const marker = {
      id: 1, markerNumber: '100', title: 'T', county: '', city: '',
      lat: 0, lng: 0, markerText: '', markerDate: '', subjectCodes: [],
      isRTHL: false, size: '',
    };
    const shapefileLookup = new Map([['100', { lat: 30.5, lng: -97.5 }]]);

    const result = mergeCoordinates(marker, shapefileLookup);
    expect(result.lat).toBe(30.5);
    expect(result.lng).toBe(-97.5);
  });

  it('falls back to UTM-converted coords', () => {
    const marker = {
      id: 1, markerNumber: '999', title: 'T', county: '', city: '',
      lat: 30.28, lng: -97.74, markerText: '', markerDate: '', subjectCodes: [],
      isRTHL: false, size: '',
    };
    const shapefileLookup = new Map<string, { lat: number; lng: number }>();

    const result = mergeCoordinates(marker, shapefileLookup);
    // Should keep the UTM-converted coords it already has
    expect(result.lat).toBeCloseTo(30.28, 1);
    expect(result.lng).toBeCloseTo(-97.74, 1);
  });

  const base: Marker = {
    id: 1, markerNumber: '8923', title: 'T', county: '', city: '',
    lat: 0, lng: 0, markerText: '', markerDate: '', subjectCodes: [],
    isRTHL: false, size: '',
  };
  // A shapefile record whose stored point is bad: once converted it lands off Texas.
  const badShapefile = new Map([['8923', { lat: 21.7719, lng: -109.5762 }]]);

  it('ignores shapefile coords outside Texas and keeps valid UTM coords [AC:OMA-DATA-PIPE-2]', () => {
    const result = mergeCoordinates({ ...base, lat: 33.58, lng: -96.18 }, badShapefile);
    expect(result.lat).toBe(33.58);
    expect(result.lng).toBe(-96.18);
  });

  it('records no coordinates when neither source is inside Texas [AC:OMA-DATA-PIPE-2]', () => {
    const result = mergeCoordinates({ ...base, lat: 1268375.41, lng: 1068706.99 }, badShapefile);
    expect(result.lat).toBe(0);
    expect(result.lng).toBe(0);
  });
});

describe('assertCoordinateCoverage [AC:OMA-DATA-PIPE-2]', () => {
  const at = (lat: number, lng: number) => ({ lat, lng }) as Marker;

  it('passes when enough markers have coordinates', () => {
    expect(() => assertCoordinateCoverage([at(30, -97), at(31, -98), at(0, 0)], 0.6)).not.toThrow();
  });

  it('stops the pipeline when coverage collapses, e.g. after a projection change', () => {
    expect(() => assertCoordinateCoverage([at(30, -97), at(0, 0), at(0, 0)], 0.6))
      .toThrow(/1 of 3 markers \(33%\) have coordinates/);
  });
});

describe('applyCorrections', () => {
  const base = { id: 1, title: '', county: '', city: '', markerText: '', markerDate: '', subjectCodes: [], isRTHL: false, size: '' };

  it('replaces coordinates for corrected markers only', async () => {
    const { applyCorrections } = await import('../coordinate-corrections');
    const out = applyCorrections([
      { ...base, markerNumber: '8923', lat: 0, lng: 0 },
      { ...base, markerNumber: '95', lat: 29.426111, lng: -98.486733 },
    ]);
    expect(out[0].lat).toBeCloseTo(33.571, 3);
    expect(out[0].lng).toBeCloseTo(-96.208, 3);
    expect(out[1].lat).toBe(29.426111);
  });

  it('rejects a correction outside Texas', async () => {
    const { applyCorrections } = await import('../coordinate-corrections');
    expect(() => applyCorrections([], [{ markerNumber: '1', lat: 33.297, lng: -80, source: 'x' }])).toThrow();
  });
});
