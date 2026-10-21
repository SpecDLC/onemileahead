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

/** Letters and digits, apostrophes dropped, so "Alamo" and "o'clock" compare as words. */
function tokensOf(text: string): string[] {
  return text.toLowerCase().replace(/['’]/g, '').match(/[a-z0-9]+/g) ?? [];
}

/**
 * Levenshtein distance ≤ 1 (a transposition is two edits). Lengths that differ by more than one
 * cannot qualify, so callers can skip those pairs.
 */
function withinOneEdit(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a.charCodeAt(i) === b.charCodeAt(j)) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (la > lb) i += 1;
    else if (lb > la) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function wordNearToken(word: string, tokens: string[]): boolean {
  for (const token of tokens) {
    if (Math.abs(token.length - word.length) > 1) continue;
    if (withinOneEdit(word, token)) return true;
  }
  return false;
}

/**
 * Keyword search over title, county, city and inscription [OMA-FUNC-SEARCH-1, -2, -3, -4].
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
 * A Fuse hit that is not an exact substring must still have every query word within one edit of
 * some word on the marker. That drops loose threshold matches such as "alamoo" → "Malakoff".
 *
 * Ranking, best first:
 * 1. Every query word appears in the title, so "alamo" ranks Alamo Cenotaph above a marker whose
 *    only Alamo is the city.
 * 2. Every query word appears exactly in some field.
 * 3. Remaining fuzzy hits.
 * Within a tier, lower Fuse score first; ties keep data order.
 */
export class SearchEngine {
  private fuse: Fuse<Marker>;
  private markers: Marker[];
  /** title, county and city, lower-cased, for the exact-word check. */
  private meta: string[];
  /** title, lower-cased, so a title hit outranks a city or county hit. */
  private titles: string[];
  /** Words of each marker, filled on first use. */
  private tokenCache: (string[] | undefined)[];

  constructor(markers: Marker[]) {
    this.markers = markers;
    this.fuse = new Fuse(markers, FUSE_OPTIONS);
    this.meta = markers.map((m) => `${m.title}\n${m.county}\n${m.city}`.toLowerCase());
    this.titles = markers.map((m) => m.title.toLowerCase());
    this.tokenCache = new Array(markers.length);
  }

  private tokens(i: number): string[] {
    const cached = this.tokenCache[i];
    if (cached) return cached;
    const m = this.markers[i];
    const tokens = tokensOf(`${m.title}\n${m.county}\n${m.city}\n${m.markerText}`);
    this.tokenCache[i] = tokens;
    return tokens;
  }

  search(query: string, limit = 20): Marker[] {
    const trimmed = query.trim();
    if (!trimmed || limit <= 0) return [];

    const words = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length >= MIN_WORD);
    const patterns = words.map((w) => new RegExp(escapeRegExp(w), 'i'));
    const inText = (i: number) =>
      patterns.length > 0 && patterns.every((p) => p.test(this.markers[i].markerText));
    const inMeta = (i: number) => words.length > 0 && words.every((w) => this.meta[i].includes(w));
    const inTitle = (i: number) => words.length > 0 && words.every((w) => this.titles[i].includes(w));
    const nearWord = (i: number) => words.length > 0 && words.every((w) => wordNearToken(w, this.tokens(i)));

    const hits = new Map<number, { title: boolean; exact: boolean; score: number }>();
    for (const r of this.fuse.search(trimmed)) {
      const exact = inMeta(r.refIndex) || inText(r.refIndex);
      if (!exact && !nearWord(r.refIndex)) continue;
      hits.set(r.refIndex, { title: inTitle(r.refIndex), exact, score: r.score ?? 1 });
    }
    if (patterns.length > 0) {
      for (let i = 0; i < this.markers.length; i++) {
        if (!hits.has(i) && inText(i)) {
          hits.set(i, { title: inTitle(i), exact: true, score: EXACT_INSCRIPTION_SCORE });
        }
      }
    }

    return [...hits.entries()]
      .sort(
        ([ia, a], [ib, b]) =>
          Number(b.title) - Number(a.title) ||
          Number(b.exact) - Number(a.exact) ||
          a.score - b.score ||
          ia - ib,
      )
      .slice(0, limit)
      .map(([i]) => this.markers[i]);
  }
}
