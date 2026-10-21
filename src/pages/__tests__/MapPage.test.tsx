import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Marker } from '../../types/marker';

// Store references accessible from both mock factories and tests
const mockMap = {
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
};

const mockCluster = {
  addLayers: vi.fn(),
};

// Mock react-leaflet (hoisted)
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  useMap: () => mockMap,
}));

// Mock leaflet.markercluster (hoisted)
vi.mock('leaflet.markercluster', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));

// Mock leaflet (hoisted)
vi.mock('leaflet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('leaflet')>();
  return {
    ...actual,
    default: {
      ...actual,
      Icon: actual.Icon,
      marker: vi.fn(() => ({
        bindPopup: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        getPopup: vi.fn(() => ({ getElement: vi.fn(() => null) })),
      })),
      markerClusterGroup: vi.fn(() => mockCluster),
    },
  };
});

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

describe('MapPage [REQ:map]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { db } = await import('../../db/database');
    await db.markers.clear();
    await db.markers.bulkAdd([
      makeMarker({ id: 1, markerNumber: '100', title: 'Marker A', lat: 30.0, lng: -97.0 }),
      makeMarker({ id: 2, markerNumber: '200', title: 'Marker B', lat: 31.0, lng: -98.0 }),
    ]);
  });

  it('renders a map container [AC:MAP-01]', async () => {
    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={() => {}} />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders a tile layer [AC:MAP-02]', async () => {
    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={() => {}} />);
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('creates a marker cluster group [AC:MAP-03]', async () => {
    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={() => {}} />);

    await vi.waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });
  });

  it('adds markers to the cluster layer [AC:MAP-04]', async () => {
    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={() => {}} />);

    await vi.waitFor(() => {
      expect(mockCluster.addLayers).toHaveBeenCalled();
      const markers = mockCluster.addLayers.mock.calls[0][0];
      expect(markers).toHaveLength(2);
    });
  });

  /** Renders whatever MapPage handed to bindPopup for the first pin. */
  async function firstPopup() {
    const L = (await import('leaflet')).default;
    await vi.waitFor(() => expect(mockCluster.addLayers).toHaveBeenCalled());
    const pin = vi.mocked(L.marker).mock.results[0].value as unknown as {
      bindPopup: ReturnType<typeof vi.fn>;
    };
    const arg = pin.bindPopup.mock.calls[0][0];
    const content: string | HTMLElement = typeof arg === 'function' ? arg(pin) : arg;
    const host = document.createElement('div');
    if (typeof content === 'string') host.innerHTML = content;
    else host.append(content);
    return host;
  }

  it('shows marker titles as text, never as HTML, in pin popups [AC:OMA-SEC-MAP-2]', async () => {
    const { db } = await import('../../db/database');
    await db.markers.clear();
    const title = '<img src=x onerror="window.__injected=1">Fort & Mission';
    await db.markers.add(makeMarker({ id: 3, markerNumber: '300', title }));

    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={() => {}} />);
    const popup = await firstPopup();

    expect(popup.querySelector('img')).toBeNull();
    expect(popup.textContent).toContain(title);
    expect(popup.textContent).toContain('#300');
  });

  it('opens the marker when its popup is tapped [AC:OMA-FUNC-MAP-1]', async () => {
    const onSelectMarker = vi.fn();
    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={onSelectMarker} />);
    const popup = await firstPopup();

    (popup.firstElementChild as HTMLElement).click();

    expect(onSelectMarker).toHaveBeenCalledWith(
      expect.objectContaining({ markerNumber: '100' }),
    );
  });

  it('reaches the popup body with Tab and opens the marker with Enter [AC:OMA-UX-A11Y-1]', async () => {
    const user = userEvent.setup();
    const onSelectMarker = vi.fn();
    const MapPage = (await import('../MapPage')).default;
    render(<MapPage onSelectMarker={onSelectMarker} />);
    const popup = await firstPopup();
    document.body.append(popup);

    try {
      await user.tab();
      const body = popup.querySelector('[role="button"]') as HTMLElement;
      expect(body).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onSelectMarker).toHaveBeenCalledWith(
        expect.objectContaining({ markerNumber: '100' }),
      );
      expect(body.querySelector('img')).toBeNull();
      expect(body.textContent).toContain('Marker A');
    } finally {
      popup.remove();
    }
  });
});
