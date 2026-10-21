import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Marker } from '../types/marker';

const FUSE_OPTIONS: IFuseOptions<Marker> = {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'county', weight: 2 },
    { name: 'city', weight: 2 },
    { name: 'markerText', weight: 1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
};

/**
 * Score given to a marker found only by the exact inscription scan: between a strong fuzzy hit
 * (near 0) and a weak one (near the 0.4 threshold), so a title match still ranks first.
 */
const EXACT_INSCRIPTION_SCORE = 0.25;

const MIN_WORD = FUSE_OPTIONS.minMatchCharLength ?? 2;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Keyword search over title, county, city and inscription [OMA-FUNC-SEARCH-1, -2].
 *
 * Two passes, merged:
 * 1. Fuse, fuzzy, with its default location window. It tolerates misspellings, but it can't see a
 *    match more than about 40 characters into a field, which is most inscription text.
 * 2. An exact scan of inscriptions: every query word (2+ characters) must appear, case-insensitive,
 *    anywhere in the text.
 *
 * Fuse's `ignoreLocation: true` also fixes pass 1's blind spot, but on the full ~17,400 markers it
 * made each search about 5× slower on the main thread and let far more fuzzy noise into the top 20
 * (see the PR that introduced this).
 *
 * Ranking: markers where every query word appears exactly (in any field) come before fuzzy-only
 * hits; within each group, lower Fuse score first; ties keep data order.
 */
export class SearchEngine {
  private fuse: Fuse<Marker>;
  private markers: Marker[];
  /** title, county and city, lower-cased, for the exact-word check. */
  private meta: string[];

  constructor(markers: Marker[]) {
    this.markers = markers;
    this.fuse = new Fuse(markers, FUSE_OPTIONS);
    this.meta = markers.map((m) => `${m.title}\n${m.county}\n${m.city}`.toLowerCase());
  }

  search(query: string, limit = 20): Marker[] {
    const trimmed = query.trim();
    if (!trimmed || limit <= 0) return [];

    const words = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length >= MIN_WORD);
    const patterns = words.map((w) => new RegExp(escapeRegExp(w), 'i'));
    const inText = (i: number) =>
      patterns.length > 0 && patterns.every((p) => p.test(this.markers[i].markerText));
    const inMeta = (i: number) => words.length > 0 && words.every((w) => this.meta[i].includes(w));

    const hits = new Map<number, { exact: boolean; score: number }>();
    for (const r of this.fuse.search(trimmed)) {
      hits.set(r.refIndex, { exact: inMeta(r.refIndex) || inText(r.refIndex), score: r.score ?? 1 });
    }
    if (patterns.length > 0) {
      for (let i = 0; i < this.markers.length; i++) {
        if (!hits.has(i) && inText(i)) hits.set(i, { exact: true, score: EXACT_INSCRIPTION_SCORE });
      }
    }

    return [...hits.entries()]
      .sort(([ia, a], [ib, b]) => Number(b.exact) - Number(a.exact) || a.score - b.score || ia - ib)
      .slice(0, limit)
      .map(([i]) => this.markers[i]);
  }
}
