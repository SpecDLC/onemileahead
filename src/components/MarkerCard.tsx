import type { Marker } from '../types/marker';
import { truncateText } from '../utils/formatting';

interface MarkerCardProps {
  marker: Marker;
  onClick: (marker: Marker) => void;
  distance?: string;
  bearing?: string;
}

export default function MarkerCard({ marker, onClick, distance, bearing: dir }: MarkerCardProps) {
  const open = () => onClick(marker);

  return (
    <article
      className="marker-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
      }}
    >
      <div className="marker-card-header">
        <span className="marker-number">#{marker.markerNumber}</span>
        {marker.isRTHL && <span className="marker-badge rthl">RTHL</span>}
        {distance && (
          <span className="marker-distance">
            {distance} {dir}
          </span>
        )}
      </div>
      <h3 className="marker-title">{marker.title}</h3>
      <p className="marker-location">
        {marker.city}, {marker.county} County
      </p>
      {marker.markerText && (
        <p className="marker-text-preview" data-testid="marker-text-preview">
          {truncateText(marker.markerText, 120)}
        </p>
      )}
    </article>
  );
}
