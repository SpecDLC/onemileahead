import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchPage from '../SearchPage';
import { db } from '../../db/database';
import type { Marker } from '../../types/marker';
import { useFeaturedMarkers } from '../../hooks/useFeaturedMarkers';

vi.mock('../../hooks/useFeaturedMarkers', () => ({
  useFeaturedMarkers: vi.fn(() => ({ featured: [], loading: false })),
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

describe('SearchPage [REQ:search]', () => {
  beforeEach(async () => {
    await db.markers.clear();
    await db.markers.bulkAdd([
      makeMarker({ id: 1, markerNumber: '100', title: 'The Alamo', county: 'Bexar', city: 'San Antonio' }),
      makeMarker({ id: 2, markerNumber: '200', title: 'Capitol Building', county: 'Travis', city: 'Austin' }),
      makeMarker({ id: 3, markerNumber: '300', title: 'San Jacinto', county: 'Harris', city: 'La Porte' }),
    ]);
    vi.mocked(useFeaturedMarkers).mockReturnValue({ featured: [], loading: false });
  });

  it('renders a search input [AC:PAGE-01]', () => {
    render(<SearchPage onSelectMarker={() => {}} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('shows results when user types a marker number [AC:PAGE-02]', async () => {
    const user = userEvent.setup();
    render(<SearchPage onSelectMarker={() => {}} />);

    await user.type(screen.getByRole('searchbox'), '100');

    await waitFor(() => {
      expect(screen.getByText('The Alamo')).toBeInTheDocument();
    });
  });

  it('shows empty state when no results [AC:PAGE-03]', async () => {
    const user = userEvent.setup();
    render(<SearchPage onSelectMarker={() => {}} />);

    await user.type(screen.getByRole('searchbox'), '99999');

    await waitFor(() => {
      expect(screen.getByText(/no markers found/i)).toBeInTheDocument();
    });
  });

  it('calls onSelectMarker when a result is clicked [AC:PAGE-04]', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SearchPage onSelectMarker={onSelect} />);

    await user.type(screen.getByRole('searchbox'), '100');

    await waitFor(() => {
      expect(screen.getByText('The Alamo')).toBeInTheDocument();
    });

    await user.click(screen.getByText('The Alamo'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ markerNumber: '100' }),
    );
  });
});

describe('SearchPage featured markers', () => {
  beforeEach(async () => {
    await db.markers.clear();
  });

  it('shows featured markers when no query', () => {
    vi.mocked(useFeaturedMarkers).mockReturnValue({
      featured: [
        {
          marker: makeMarker({ id: 95, markerNumber: '95', title: 'Alamo Cenotaph' }),
          research: {
            markerNumber: '95',
            generatedAt: '2026-02-28',
            links: [
              { title: 'Battle of the Alamo', url: 'https://example.com', source: 'grokipedia', description: 'A battle' },
            ],
          },
        },
      ],
      loading: false,
    });

    render(<SearchPage onSelectMarker={() => {}} />);
    expect(screen.getByText('Featured Markers')).toBeInTheDocument();
    expect(screen.getByText('Alamo Cenotaph')).toBeInTheDocument();
  });

  it('hides featured markers when query is active', async () => {
    const user = userEvent.setup();
    vi.mocked(useFeaturedMarkers).mockReturnValue({
      featured: [
        {
          marker: makeMarker({ id: 95, markerNumber: '95', title: 'Alamo Cenotaph' }),
          research: {
            markerNumber: '95',
            generatedAt: '2026-02-28',
            links: [
              { title: 'Battle of the Alamo', url: 'https://example.com', source: 'grokipedia', description: 'A battle' },
            ],
          },
        },
      ],
      loading: false,
    });

    render(<SearchPage onSelectMarker={() => {}} />);
    expect(screen.getByText('Featured Markers')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox'), 'test');
    expect(screen.queryByText('Featured Markers')).not.toBeInTheDocument();
  });
});
