import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../database';
import { seedDatabase, isSeeded } from '../seed';
import type { Marker } from '../../types/marker';

const SAMPLE_MARKERS: Marker[] = [
  {
    id: 1, markerNumber: '100', title: 'First Marker', county: 'Travis',
    city: 'Austin', lat: 30.27, lng: -97.74, markerText: 'Text 1',
    markerDate: '1970', subjectCodes: ['buildings'], isRTHL: false, size: '',
  },
  {
    id: 2, markerNumber: '200', title: 'Second Marker', county: 'Harris',
    city: 'Houston', lat: 29.76, lng: -95.37, markerText: 'Text 2',
    markerDate: '1980', subjectCodes: ['counties'], isRTHL: true, size: '',
  },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('seedDatabase [REQ:database]', () => {
  it('inserts markers into the database [AC:DB-seed-01]', async () => {
    await seedDatabase(SAMPLE_MARKERS);
    const count = await db.markers.count();
    expect(count).toBe(2);
  });

  it('sets seeded metadata flag [AC:DB-seed-02]', async () => {
    await seedDatabase(SAMPLE_MARKERS);
    expect(await isSeeded()).toBe(true);
  });

  it('reports not seeded before seeding [AC:DB-seed-03]', async () => {
    expect(await isSeeded()).toBe(false);
  });

  it('skips seeding if already seeded [AC:DB-seed-04]', async () => {
    await seedDatabase(SAMPLE_MARKERS);
    const countBefore = await db.markers.count();

    // Seed again — should be no-op
    await seedDatabase(SAMPLE_MARKERS);
    const countAfter = await db.markers.count();

    expect(countAfter).toBe(countBefore);
  });

  it('emits progress callbacks during bulk insert [AC:DB-seed-05]', async () => {
    const progress = vi.fn();
    await seedDatabase(SAMPLE_MARKERS, { onProgress: progress });

    expect(progress).toHaveBeenCalled();
    // Last call should be 100%
    const lastCall = progress.mock.calls[progress.mock.calls.length - 1];
    expect(lastCall[0]).toBe(100);
  });
});
