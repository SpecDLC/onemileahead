/**
 * THC's HistoricalMarkers shapefile stores points in NAD83 / Texas State
 * Mapping System (EPSG:3081): Lambert conformal conic, in metres. The app
 * needs WGS84 latitude/longitude.
 */
import proj4 from 'proj4';
import { TEXAS_BOUNDS } from './texas-bounds';
import type { LatLng } from './utm-converter';

const TEXAS_STATE_MAPPING_SYSTEM =
  '+proj=lcc +lat_0=31.1666666666667 +lon_0=-100 +lat_1=27.4166666666667 ' +
  '+lat_2=34.9166666666667 +x_0=1000000 +y_0=1000000 +datum=NAD83 +units=m +no_defs';

const toWgs84 = proj4(TEXAS_STATE_MAPPING_SYSTEM, 'WGS84');

/** Converts a shapefile point (x = easting, y = northing) to lat/lng, rounded to 6 places like the UTM path. */
export function texasMappingToLatLng(x: number, y: number): LatLng {
  const [lng, lat] = toWgs84.forward([x, y]);
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
  };
}

export function isInTexas(lat: number, lng: number): boolean {
  return (
    lat >= TEXAS_BOUNDS.latMin && lat <= TEXAS_BOUNDS.latMax &&
    lng >= TEXAS_BOUNDS.lngMin && lng <= TEXAS_BOUNDS.lngMax
  );
}
