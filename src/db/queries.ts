import { db } from './database';
import type { Marker } from '../types/marker';

/**
 * Find a marker by exact marker number.
 */
export async function findByMarkerNumber(
  num: string,
): Promise<Marker | undefined> {
  return db.markers.where('markerNumber').equals(num).first();
}

/**
 * Find markers whose number starts with a given prefix.
 * Used for as-you-type search on the marker number field.
 */
export async function findByMarkerNumberPrefix(
  prefix: string,
  limit = 20,
): Promise<Marker[]> {
  return db.markers
    .where('markerNumber')
    .startsWith(prefix)
    .limit(limit)
    .toArray();
}

/**
 * Find all markers in a given county.
 */
export async function findByCounty(county: string): Promise<Marker[]> {
  return db.markers.where('county').equals(county).toArray();
}

/**
 * Get a single marker by its ID.
 */
export async function getMarkerById(
  id: number,
): Promise<Marker | undefined> {
  return db.markers.get(id);
}
