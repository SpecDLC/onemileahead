import { describe, it, expect } from 'vitest';
import { haversineDistance, bearing, formatDistance, formatBearing } from '../distance';

describe('haversineDistance [REQ:utilities]', () => {
  it('returns 0 for same point [AC:UTIL-01]', () => {
    expect(haversineDistance(30.0, -97.0, 30.0, -97.0)).toBe(0);
  });

  it('calculates Austin to Houston ~146 miles great-circle [AC:UTIL-02]', () => {
    // Austin: 30.2672, -97.7431  Houston: 29.7604, -95.3698
    // Great-circle distance is ~146 mi (driving distance is ~165 mi)
    const miles = haversineDistance(30.2672, -97.7431, 29.7604, -95.3698);
    expect(miles).toBeGreaterThan(140);
    expect(miles).toBeLessThan(155);
  });

  it('calculates short distances accurately [AC:UTIL-03]', () => {
    // ~1 mile apart (approx 0.0145 degrees latitude)
    const miles = haversineDistance(30.0, -97.0, 30.0145, -97.0);
    expect(miles).toBeGreaterThan(0.9);
    expect(miles).toBeLessThan(1.1);
  });
});

describe('bearing [REQ:utilities]', () => {
  it('returns ~0 for due north [AC:UTIL-04]', () => {
    const b = bearing(30.0, -97.0, 31.0, -97.0);
    expect(b).toBeCloseTo(0, 0);
  });

  it('returns ~90 for due east [AC:UTIL-05]', () => {
    const b = bearing(30.0, -97.0, 30.0, -96.0);
    expect(b).toBeGreaterThan(85);
    expect(b).toBeLessThan(95);
  });

  it('returns ~180 for due south [AC:UTIL-06]', () => {
    const b = bearing(30.0, -97.0, 29.0, -97.0);
    expect(b).toBeCloseTo(180, 0);
  });

  it('returns ~270 for due west [AC:UTIL-07]', () => {
    const b = bearing(30.0, -97.0, 30.0, -98.0);
    expect(b).toBeGreaterThan(265);
    expect(b).toBeLessThan(275);
  });
});

describe('formatDistance [REQ:utilities]', () => {
  it('formats miles with one decimal [AC:UTIL-08]', () => {
    expect(formatDistance(1.5)).toBe('1.5 mi');
    expect(formatDistance(0.3)).toBe('0.3 mi');
  });

  it('shows whole number for >= 10 miles [AC:UTIL-09]', () => {
    expect(formatDistance(25.7)).toBe('26 mi');
    expect(formatDistance(100.2)).toBe('100 mi');
  });

  it('shows feet for very short distances [AC:UTIL-10]', () => {
    expect(formatDistance(0.05)).toBe('264 ft');
  });
});

describe('formatBearing [REQ:utilities]', () => {
  it('formats cardinal directions [AC:UTIL-11]', () => {
    expect(formatBearing(0)).toBe('N');
    expect(formatBearing(90)).toBe('E');
    expect(formatBearing(180)).toBe('S');
    expect(formatBearing(270)).toBe('W');
  });

  it('formats intercardinal directions [AC:UTIL-12]', () => {
    expect(formatBearing(45)).toBe('NE');
    expect(formatBearing(135)).toBe('SE');
    expect(formatBearing(225)).toBe('SW');
    expect(formatBearing(315)).toBe('NW');
  });
});
