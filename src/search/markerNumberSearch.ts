import { db } from '../db/database';
import type { Marker } from '../types/marker';

/**
 * Exact match first, then numeric order ("2" before "10"). Ties fall back to the primary key so
 * the order is stable.
 */
function compareNumbers(trimmed: string) {
  return (a: { num: string; id: number }, b: { num: string; id: number }): number => {
    if (a.num === trimmed && b.num !== trimmed) return -1;
    if (b.num === trimmed && a.num !== trimmed) return 1;
    return a.num.localeCompare(b.num, undefined, { numeric: true }) || a.id - b.id;
  };
}

/**
 * Search for markers by number. Returns the exact match first, then the lowest-numbered markers
 * whose numbers start with the query, up to `limit` [OMA-FUNC-LOOKUP-2].
 *
 * The prefix range is read as index keys and primary keys only (no records), sorted, and then just
 * the top `limit` records are fetched. Limiting in the index's string order would keep 1, 10, 100,
 * 1000… and never reach numbers like 11 or 12.
 */
export async function searchByMarkerNumber(
  query: string,
  limit = 20,
): Promise<Marker[]> {
  const trimmed = query.trim();
  if (!trimmed || limit <= 0) return [];

  // One key cursor over the index: each step gives the index key (marker number) and primary key.
  const matches: { num: string; id: number }[] = [];
  await db.markers
    .where('markerNumber')
    .startsWith(trimmed)
    .eachPrimaryKey((id, cursor) => {
      matches.push({ num: String(cursor.key), id });
    });

  const top = matches.sort(compareNumbers(trimmed)).slice(0, limit);

  const records = await db.markers.bulkGet(top.map((t) => t.id));
  return records.filter((m): m is Marker => m !== undefined);
}
