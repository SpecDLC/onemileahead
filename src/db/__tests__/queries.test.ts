import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database';
import {
  findByMarkerNumber,
  findByMarkerNumberPrefix,
  findByCounty,
  getMarkerById,
} from '../queries';
import type { Marker } from '../../types/marker';

const MARKERS: Marker[] = [
  {
    id: 1, markerNumber: '1234', title: 'Alamo', county: 'Bexar',
    city: 'San Antonio', lat: 29.43, lng: -98.49, markerText: 'The Alamo.',
    markerDate: '1936', subjectCodes: ['buildings'], isRTHL: true, size: '',
  },
  {
    id: 2, markerNumber: '1256', title: 'Capitol', county: 'Travis',
    city: 'Austin', lat: 30.27, lng: -97.74, markerText: 'State Capitol.',
    markerDate: '1970', subjectCodes: ['government'], isRTHL: false, size: '',
  },
  {
    id: 3, markerNumber: '5678', title: 'Spindletop', county: 'Jefferson',
    city: 'Beaumont', lat: 30.01, lng: -94.07, markerText: 'Oil discovery.',
    markerDate: '1960', subjectCodes: ['industry'], isRTHL: true, size: '',
  },
  {
    id: 4, markerNumber: '1299', title: 'Mission', county: 'Bexar',
    city: 'San Antonio', lat: 29.35, lng: -98.45, markerText: 'San Jose.',
    markerDate: '1968', subjectCodes: ['churches'], isRTHL: false, size: '',
  },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.markers.bulkAdd(MARKERS);
});

describe('Marker queries [REQ:database]', () => {
  it('finds exact marker by number [AC:DB-query-01]', async () => {
    const result = await findByMarkerNumber('1234');
    expect(result).toBeDefined();
    expect(result!.title).toBe('Alamo');
  });

  it('returns undefined for missing marker number [AC:DB-query-02]', async () => {
    const result = await findByMarkerNumber('9999');
    expect(result).toBeUndefined();
  });

  it('finds markers by number prefix [AC:DB-query-03]', async () => {
    const results = await findByMarkerNumberPrefix('12');
    expect(results).toHaveLength(3); // 1234, 1256, 1299
    expect(results.map((m) => m.markerNumber).sort()).toEqual(['1234', '1256', '1299']);
  });

  it('returns empty for no matching prefix [AC:DB-query-04]', async () => {
    const results = await findByMarkerNumberPrefix('99');
    expect(results).toHaveLength(0);
  });

  it('limits prefix results [AC:DB-query-05]', async () => {
    const results = await findByMarkerNumberPrefix('12', 2);
    expect(results).toHaveLength(2);
  });

  it('finds markers by county [AC:DB-query-06]', async () => {
    const results = await findByCounty('Bexar');
    expect(results).toHaveLength(2);
  });

  it('gets marker by ID [AC:DB-query-07]', async () => {
    const result = await getMarkerById(3);
    expect(result).toBeDefined();
    expect(result!.title).toBe('Spindletop');
  });
});
