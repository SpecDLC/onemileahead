import { db } from './database';
import type { Marker } from '../types/marker';

const SEED_KEY = 'dataSeeded';
const BATCH_SIZE = 1000;

export interface SeedOptions {
  onProgress?: (percent: number) => void;
}

/**
 * Check if the database has already been seeded with marker data.
 */
export async function isSeeded(): Promise<boolean> {
  const meta = await db.meta.get(SEED_KEY);
  return meta?.value === 'true';
}

/**
 * Seed the database with marker data.
 * Uses batched bulkPut for performance. Skips if already seeded.
 */
export async function seedDatabase(
  markers: Marker[],
  options: SeedOptions = {},
): Promise<void> {
  if (await isSeeded()) {
    options.onProgress?.(100);
    return;
  }

  // Clear any partial data from a previous failed seed
  await db.markers.clear();

  const total = markers.length;
  let inserted = 0;

  // Insert in batches to avoid blocking the UI thread
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = markers.slice(i, i + BATCH_SIZE);
    await db.markers.bulkPut(batch);
    inserted += batch.length;
    options.onProgress?.(Math.round((inserted / total) * 100));
  }

  // Mark as seeded
  await db.meta.put({ key: SEED_KEY, value: 'true' });
}
