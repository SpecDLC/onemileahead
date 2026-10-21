import { useGeolocation } from '../hooks/useGeolocation';
import { useNearbyMarkers } from '../hooks/useNearbyMarkers';
import MarkerCard from '../components/MarkerCard';
import { formatDistance, formatBearing } from '../utils/distance';
import type { Marker } from '../types/marker';

interface NearbyPageProps {
  onSelectMarker: (marker: Marker) => void;
}

export default function NearbyPage({ onSelectMarker }: NearbyPageProps) {
  const { position, error } = useGeolocation();
  const { markers, isLoading } = useNearbyMarkers(position);

  return (
    <div className="nearby-page">
      <h2 className="nearby-title">Nearby Markers</h2>
      {error && (
        <p className="nearby-status">Location unavailable: {error}</p>
      )}
      {!position && !error && (
        <p className="nearby-status">Getting your location...</p>
      )}
      {isLoading && <p className="nearby-status">Loading nearby markers...</p>}
      <div className="nearby-list">
        {markers.map(({ marker, distance, bearing: dir }) => (
          <MarkerCard
            key={marker.id}
            marker={marker}
            onClick={onSelectMarker}
            distance={formatDistance(distance)}
            bearing={formatBearing(dir)}
          />
        ))}
      </div>
    </div>
  );
}
