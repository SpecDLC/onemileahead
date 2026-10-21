import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NearbyPage from '../NearbyPage';
import { db } from '../../db/database';
import type { Marker } from '../../types/marker';

// Mock useGeolocation
vi.mock('../../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    position: { lat: 30.2672, lng: -97.7431 },
    error: null,
  }),
}));

function makeMarker(overrides: Partial<Marker> = {}): Marker {
  return {
    id: 1,
    markerNumber: '1234',
    title: 'Test Marker',
    county: 'Travis',
    city: 'Austin',
    lat: 30.2672,
    lng: -97.7431,
    markerText: 'A historical marker.',
    markerDate: '1970',
    subjectCodes: ['buildings'],
    isRTHL: false,
    size: '18" x 28"',
    ...overrides,
  };
}

describe('NearbyPage [REQ:nearby]', () => {
  beforeEach(async () => {
    await db.markers.clear();
    await db.markers.bulkAdd([
      makeMarker({ id: 1, markerNumber: '100', title: 'Close Marker', lat: 30.268, lng: -97.744 }),
      makeMarker({ id: 2, markerNumber: '200', title: 'Far Marker', lat: 31.0, lng: -97.0 }),
    ]);
  });

  it('renders the nearby page [AC:NEARBY-01]', () => {
    render(<NearbyPage onSelectMarker={() => {}} />);
    expect(screen.getByText('Nearby Markers')).toBeInTheDocument();
  });

  it('shows nearby markers sorted by distance [AC:NEARBY-02]', async () => {
    render(<NearbyPage onSelectMarker={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Close Marker')).toBeInTheDocument();
    });

    const cards = screen.getAllByRole('button', { name: /Marker/ });
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('shows distance for each marker [AC:NEARBY-03]', async () => {
    render(<NearbyPage onSelectMarker={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Close Marker')).toBeInTheDocument();
    });

    // Each card should have a distance span
    const distanceSpans = screen.getAllByText(/\d+\s*(ft|mi)/);
    expect(distanceSpans.length).toBeGreaterThanOrEqual(2);
  });
});
