import { describe, it, expect, beforeAll } from 'vitest';
import { SearchEngine } from '../searchEngine';
import type { Marker } from '../../types/marker';

function makeMarker(overrides: Partial<Marker> = {}): Marker {
  return {
    id: 1,
    markerNumber: '1234',
    title: 'Test Marker',
    county: 'Travis',
    city: 'Austin',
    lat: 30.2672,
    lng: -97.7431,
    markerText: 'A historical marker about something important.',
    markerDate: '1970',
    subjectCodes: ['buildings'],
    isRTHL: false,
    size: '18" x 28"',
    ...overrides,
  };
}

const testMarkers: Marker[] = [
  makeMarker({ id: 1, markerNumber: '100', title: 'The Alamo', county: 'Bexar', city: 'San Antonio', markerText: 'Site of the famous 1836 battle.' }),
  makeMarker({ id: 2, markerNumber: '200', title: 'San Jacinto Battleground', county: 'Harris', city: 'La Porte', markerText: 'Where Texas won independence from Mexico.' }),
  makeMarker({ id: 3, markerNumber: '300', title: 'Spindletop Oil Well', county: 'Jefferson', city: 'Beaumont', markerText: 'The first major oil gusher in Texas.' }),
  makeMarker({ id: 4, markerNumber: '400', title: 'King Ranch', county: 'Kleberg', city: 'Kingsville', markerText: 'One of the largest ranches in the world.' }),
  makeMarker({ id: 5, markerNumber: '500', title: 'Dealey Plaza', county: 'Dallas', city: 'Dallas', markerText: 'Historic plaza in downtown Dallas.' }),
  makeMarker({ id: 6, markerNumber: '600', title: 'San Fernando Cathedral', county: 'Bexar', city: 'San Antonio', markerText: 'The oldest cathedral in Texas.' }),
];

describe('SearchEngine [REQ:search]', () => {
  let engine: SearchEngine;

  beforeAll(() => {
    engine = new SearchEngine(testMarkers);
  });

  it('finds markers by title [AC:SEARCH-01]', () => {
    const results = engine.search('Alamo');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].markerNumber).toBe('100');
  });

  it('finds markers by county [AC:SEARCH-02]', () => {
    const results = engine.search('Dallas');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.county === 'Dallas')).toBe(true);
  });

  it('finds markers by city [AC:SEARCH-03]', () => {
    const results = engine.search('Beaumont');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].city).toBe('Beaumont');
  });

  it('finds markers by text content [AC:SEARCH-04]', () => {
    const results = engine.search('oil gusher');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Spindletop Oil Well');
  });

  it('handles fuzzy matching [AC:SEARCH-05]', () => {
    // Slight misspelling
    const results = engine.search('Almo');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('The Alamo');
  });

  it('returns empty array for no matches [AC:SEARCH-06]', () => {
    const results = engine.search('xyznonexistent');
    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty query [AC:SEARCH-07]', () => {
    const results = engine.search('');
    expect(results).toHaveLength(0);
  });

  it('respects limit parameter [AC:SEARCH-08]', () => {
    const results = engine.search('San', 1);
    expect(results).toHaveLength(1);
  });

  it('prioritizes title matches over text matches [AC:SEARCH-09]', () => {
    // "San" appears in titles (San Jacinto, San Fernando, San Antonio cities)
    const results = engine.search('San Jacinto');
    expect(results[0].title).toBe('San Jacinto Battleground');
  });

  it('can be rebuilt with new data [AC:SEARCH-10]', () => {
    const newEngine = new SearchEngine([
      makeMarker({ id: 99, markerNumber: '999', title: 'Brand New Marker' }),
    ]);
    const results = newEngine.search('Brand New');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].markerNumber).toBe('999');
  });
});

describe('SearchEngine finds inscription text anywhere [OMA-FUNC-SEARCH-1]', () => {
  // Realistic-length inscription prose (~380 characters) with a unique word placed at a given offset.
  const FILLER =
    'Settlers arrived in the area during the 1850s and established farms along the creek. ' +
    'A post office opened in 1872, followed by a general store, a cotton gin and two churches. ' +
    'The community grew when the railroad came through in 1881, and the town served as a shipping ' +
    'point for cattle and cotton for several decades. A school building was erected in 1903 and ' +
    'remained in use until consolidation in 1949.';

  function withWordAt(offset: number, id: number): Marker {
    const text = FILLER.slice(0, offset) + ' Quillfeather ' + FILLER.slice(offset);
    return makeMarker({ id, markerNumber: String(id), title: `Marker ${id}`, county: 'Bell', city: 'Temple', markerText: text });
  }

  it.each([10, 60, 120, 300])('finds a unique inscription word at character %i', (offset) => {
    const engine = new SearchEngine([withWordAt(offset, 1), makeMarker({ id: 2, markerNumber: '2', markerText: FILLER })]);
    const results = engine.search('Quillfeather');
    expect(results.map((r) => r.id)).toEqual([1]);
  });

  it('still returns nothing for a word that appears in no field', () => {
    const engine = new SearchEngine([withWordAt(200, 1), makeMarker({ id: 2, markerNumber: '2', markerText: FILLER })]);
    expect(engine.search('xyznonexistent')).toHaveLength(0);
  });

  it('still ranks a title match above an inscription-only match', () => {
    const engine = new SearchEngine([
      withWordAt(300, 1),
      makeMarker({ id: 2, markerNumber: '2', title: 'Quillfeather House', markerText: FILLER }),
    ]);
    expect(engine.search('Quillfeather')[0].id).toBe(2);
  });
});
