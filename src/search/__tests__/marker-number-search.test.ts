import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/database';
import { searchByMarkerNumber } from '../markerNumberSearch';
import type { Marker } from '../../types/marker';

const MARKERS: Marker[] = [
  {
    id: 1, markerNumber: '1234', title: 'Alamo', county: 'Bexar',
    city: 'San Antonio', lat: 29.43, lng: -98.49, markerText: 'The Alamo.',
    markerDate: '1936', subjectCodes: [], isRTHL: true, size: '',
  },
  {
    id: 2, markerNumber: '1256', title: 'Capitol', county: 'Travis',
    city: 'Austin', lat: 30.27, lng: -97.74, markerText: 'State Capitol.',
    markerDate: '1970', subjectCodes: [], isRTHL: false, size: '',
  },
  {
    id: 3, markerNumber: '5678', title: 'Spindletop', county: 'Jefferson',
    city: 'Beaumont', lat: 30.01, lng: -94.07, markerText: 'Oil discovery.',
    markerDate: '1960', subjectCodes: [], isRTHL: true, size: '',
  },
  {
    id: 4, markerNumber: '12', title: 'Short Number', county: 'Dallas',
    city: 'Dallas', lat: 32.78, lng: -96.80, markerText: 'Short.',
    markerDate: '1950', subjectCodes: [], isRTHL: false, size: '',
  },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.markers.bulkAdd(MARKERS);
});

describe('searchByMarkerNumber [REQ:search-001]', () => {
  it('returns exact match for valid marker number [AC:search-001-01]', async () => {
    const results = await searchByMarkerNumber('1234');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Alamo');
  });

  it('returns prefix matches as user types [AC:search-001-02]', async () => {
    const results = await searchByMarkerNumber('12');
    // Should find: 12, 1234, 1256
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('shows "not found" for invalid number [AC:search-001-03]', async () => {
    const results = await searchByMarkerNumber('9999');
    expect(results).toHaveLength(0);
  });

  it('prioritizes exact match first [AC:search-001-04]', async () => {
    const results = await searchByMarkerNumber('12');
    expect(results[0].markerNumber).toBe('12');
  });

  it('handles empty input [AC:search-001-05]', async () => {
    const results = await searchByMarkerNumber('');
    expect(results).toHaveLength(0);
  });

  it('limits results [AC:search-001-06]', async () => {
    const results = await searchByMarkerNumber('1', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe('searchByMarkerNumber ordering [OMA-FUNC-LOOKUP-2]', () => {
  // Inserted in an order unrelated to their numbers; string order would be 1, 10, 100, 1000, 11, 12, 13, 19, 2.
  const NUMBERS = ['1000', '13', '100', '2', '12', '10', '19', '1', '11'];

  beforeEach(async () => {
    await db.markers.clear();
    await db.markers.bulkAdd(
      NUMBERS.map((n, i) => ({ ...MARKERS[0], id: 100 + i, markerNumber: n, title: `Marker ${n}` })),
    );
  });

  it('returns the lowest-numbered prefix matches when there are more than the limit', async () => {
    const results = await searchByMarkerNumber('1', 4);
    // Not 1, 10, 100, 1000 (the first four in string order).
    expect(results.map((m) => m.markerNumber)).toEqual(['1', '10', '11', '12']);
  });

  it('keeps an exact match first and the rest in numeric order', async () => {
    const results = await searchByMarkerNumber('1');
    expect(results.map((m) => m.markerNumber)).toEqual(['1', '10', '11', '12', '13', '19', '100', '1000']);
  });

  it('returns full marker records', async () => {
    const [first] = await searchByMarkerNumber('13', 1);
    expect(first).toMatchObject({ id: 101, markerNumber: '13', title: 'Marker 13' });
  });
});
