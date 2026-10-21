import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Database schema [REQ:database]', () => {
  it('creates markers table with correct indexes [AC:DB-01]', () => {
    const table = db.table('markers');
    expect(table).toBeDefined();
    expect(table.schema.primKey.name).toBe('id');
  });

  it('can add and retrieve a marker [AC:DB-02]', async () => {
    await db.markers.add({
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
    });

    const marker = await db.markers.get(1);
    expect(marker).toBeDefined();
    expect(marker!.markerNumber).toBe('1234');
    expect(marker!.title).toBe('Test Marker');
  });

  it('supports lookup by markerNumber index [AC:DB-03]', async () => {
    await db.markers.bulkAdd([
      {
        id: 1, markerNumber: '100', title: 'First', county: 'Travis',
        city: 'Austin', lat: 30, lng: -97, markerText: '', markerDate: '1970',
        subjectCodes: [], isRTHL: false, size: '',
      },
      {
        id: 2, markerNumber: '200', title: 'Second', county: 'Harris',
        city: 'Houston', lat: 29, lng: -95, markerText: '', markerDate: '1980',
        subjectCodes: [], isRTHL: false, size: '',
      },
    ]);

    const result = await db.markers.where('markerNumber').equals('200').first();
    expect(result?.title).toBe('Second');
  });

  it('supports prefix search on markerNumber [AC:DB-04]', async () => {
    await db.markers.bulkAdd([
      {
        id: 1, markerNumber: '1234', title: 'A', county: '', city: '',
        lat: 0, lng: 0, markerText: '', markerDate: '', subjectCodes: [],
        isRTHL: false, size: '',
      },
      {
        id: 2, markerNumber: '1256', title: 'B', county: '', city: '',
        lat: 0, lng: 0, markerText: '', markerDate: '', subjectCodes: [],
        isRTHL: false, size: '',
      },
      {
        id: 3, markerNumber: '5678', title: 'C', county: '', city: '',
        lat: 0, lng: 0, markerText: '', markerDate: '', subjectCodes: [],
        isRTHL: false, size: '',
      },
    ]);

    const results = await db.markers
      .where('markerNumber')
      .startsWith('12')
      .toArray();
    expect(results).toHaveLength(2);
  });

  it('tracks metadata in meta table [AC:DB-05]', async () => {
    await db.meta.put({ key: 'dataVersion', value: '2026-02-28' });
    const meta = await db.meta.get('dataVersion');
    expect(meta?.value).toBe('2026-02-28');
  });
});
