/**
 * Hand-checked coordinates for markers whose THC source point is wrong or
 * missing. Applied after the shapefile/UTM merge; each entry names its source.
 */
import type { Marker } from '../src/types/marker';
import { isInTexas } from './texas-mapping';

export interface CoordinateCorrection {
  markerNumber: string;
  lat: number;
  lng: number;
  source: string;
}

const ZONE_14 =
  'THC CSV UTM easting/northing read as zone 14 instead of the labelled zone 15 (GitHub issue 4 pipeline note, 2026-10-02)';

export const COORDINATE_CORRECTIONS: CoordinateCorrection[] = [
  { markerNumber: '8923', lat: 33.571088, lng: -96.208032, source: ZONE_14 },
  { markerNumber: '14550', lat: 30.142393, lng: -96.851402, source: ZONE_14 },
  { markerNumber: '16270', lat: 29.594314, lng: -96.332473, source: ZONE_14 },
  {
    // THC UTM (zone 15, 473375 / 3684265) lands near Arkansas; the cemetery is 6 mi S of Kountze.
    markerNumber: '11159',
    lat: 30.3197,
    lng: -94.2419,
    source: 'Find a Grave cemetery 4344 GPS (https://www.findagrave.com/cemetery/4344/hooks-cemetery); THC Atlas 5199011159 location "6 mi. S of Kountze on Hooks Cemetery Rd., off US 69"',
  },
  {
    // THC UTM (zone 15, 240834 / 2648020) gives an impossible latitude; THC says "4 mi. north of Emory".
    markerNumber: '10856',
    lat: 32.940233,
    lng: -95.771733,
    source: 'HMDB marker 280090, 32°56.414′N 95°46.304′W (https://www.hmdb.org/m.asp?m=280090); THC Atlas 5379010856 location "SH 275, 4 mi. north of Emory"',
  },
];

/** Replaces coordinates for corrected markers. A correction outside Texas is a bug in the table, so it throws. */
export function applyCorrections(
  markers: Marker[],
  corrections: CoordinateCorrection[] = COORDINATE_CORRECTIONS,
): Marker[] {
  const byNumber = new Map(corrections.map((c) => [c.markerNumber, c]));
  for (const c of corrections) {
    if (!isInTexas(c.lat, c.lng)) {
      throw new Error(`Correction for marker ${c.markerNumber} is outside Texas.`);
    }
  }
  return markers.map((m) => {
    const c = byNumber.get(m.markerNumber);
    return c ? { ...m, lat: c.lat, lng: c.lng } : m;
  });
}
