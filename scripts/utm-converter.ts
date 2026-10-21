/**
 * UTM to WGS84 (lat/lng) coordinate conversion.
 * Supports UTM zones 13 and 14 which cover Texas.
 *
 * Based on Karney's algorithm for UTM projection.
 */

const K0 = 0.9996; // UTM scale factor
const E = 0.00669438; // WGS84 eccentricity squared
const E2 = E * E;
const E3 = E2 * E;
const E_P2 = E / (1 - E);
const R = 6378137; // WGS84 equatorial radius

const SQRT_E = Math.sqrt(1 - E);
const _E = (1 - SQRT_E) / (1 + SQRT_E);
const _E2 = _E * _E;
const _E3 = _E2 * _E;
const _E4 = _E3 * _E;
const M1 = 1 - E / 4 - (3 * E2) / 64 - (5 * E3) / 256;
const M2 = (3 * _E) / 2 - (27 * _E3) / 32;
const M3 = (21 * _E2) / 16 - (55 * _E4) / 32;
const M4 = (151 * _E3) / 96;
const M5 = (1097 * _E4) / 512;

export interface LatLng {
  lat: number;
  lng: number;
}

export function utmToLatLng(
  easting: number,
  northing: number,
  zone: number,
  northern: boolean = true,
): LatLng {
  const x = easting - 500000;
  const y = northern ? northing : northing - 10000000;

  const m = y / K0;
  const mu = m / (R * M1);

  const pRad =
    mu +
    M2 * Math.sin(2 * mu) +
    M3 * Math.sin(4 * mu) +
    M4 * Math.sin(6 * mu) +
    M5 * Math.sin(8 * mu);

  const pSin = Math.sin(pRad);
  const pSin2 = pSin * pSin;
  const pCos = Math.cos(pRad);
  const pTan = Math.tan(pRad);
  const pTan2 = pTan * pTan;
  const pTan4 = pTan2 * pTan2;

  const epSin = 1 - E * pSin2;
  const epSinSqrt = Math.sqrt(epSin);

  const n = R / epSinSqrt;
  const r = (1 - E) / epSin;
  const c = E_P2 * pCos * pCos;
  const c2 = c * c;

  const d = x / (n * K0);
  const d2 = d * d;
  const d3 = d2 * d;
  const d4 = d3 * d;
  const d5 = d4 * d;
  const d6 = d5 * d;

  const lat =
    pRad -
    ((pTan / r) *
      (d2 / 2 - ((5 + 3 * pTan2 + 10 * c - 4 * c2 - 9 * E_P2) * d4) / 24 +
        ((61 + 90 * pTan2 + 298 * c + 45 * pTan4 - 252 * E_P2 - 3 * c2) *
          d6) /
          720));

  const lng =
    (d -
      ((1 + 2 * pTan2 + c) * d3) / 6 +
      ((5 - 2 * c + 28 * pTan2 - 3 * c2 + 8 * E_P2 + 24 * pTan4) * d5) /
        120) /
    pCos;

  const latDeg = (lat * 180) / Math.PI;
  const lngDeg = (lng * 180) / Math.PI + (zone - 1) * 6 - 180 + 3;

  return { lat: latDeg, lng: lngDeg };
}
