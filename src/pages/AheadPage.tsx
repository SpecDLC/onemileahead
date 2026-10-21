import { useGeolocation } from '../hooks/useGeolocation';
import { useAhead } from '../hooks/useAhead';
import MarkerCard from '../components/MarkerCard';
import { formatDistance } from '../utils/distance';
import type { Marker } from '../types/marker';

interface AheadPageProps {
  onSelectMarker: (marker: Marker) => void;
}

const STATUS_TEXT: Record<string, string> = {
  no_fixes: 'Getting your location...',
  stationary: "You're stopped. Markers ahead will show once you're moving.",
  no_heading: 'Working out which way you are heading...',
  no_speed: 'Working out whether you are moving...',
  gps_jump: 'Location jumped. Waiting for the next fix to confirm it...',
};

function eta(seconds: number | null): string {
  if (seconds == null) return '';
  return seconds < 60 ? 'under a minute' : `about ${Math.round(seconds / 60)} min`;
}

/** Markers coming up on the road ahead. */
export default function AheadPage({ onSelectMarker }: AheadPageProps) {
  const { position, error } = useGeolocation();
  const { available, result, cues } = useAhead(position);

  return (
    <div className="nearby-page">
      <h2 className="nearby-title">Up Ahead</h2>
      {available === false && (
        <p className="nearby-status">
          The Ahead view needs the WebAssembly engine, which didn't load in this browser. Nearby still works.
        </p>
      )}
      {error && <p className="nearby-status">Location unavailable: {error}</p>}
      {available && result && result.status !== 'ok' && (
        <p className="nearby-status">{STATUS_TEXT[result.status]}</p>
      )}
      {cues.length > 0 && (
        <div role="status" aria-live="polite">
          {cues.map((cue) => (
            <p className="nearby-status" key={cue.marker.id}>
              One mile ahead, on your {cue.side}: <strong>{cue.marker.title}</strong>
            </p>
          ))}
        </div>
      )}
      {available && result?.status === 'ok' && result.results.length === 0 && (
        <p className="nearby-status">No markers along the next 10 miles of road.</p>
      )}
      <div className="nearby-list">
        {result?.status === 'ok' &&
          result.results.map((item) => (
            <MarkerCard
              key={item.marker.id}
              marker={item.marker}
              onClick={onSelectMarker}
              distance={`${formatDistance(item.along_mi)} ahead`}
              bearing={`on the ${item.side}${item.eta_s != null ? `, ${eta(item.eta_s)}` : ''}`}
            />
          ))}
      </div>
    </div>
  );
}
