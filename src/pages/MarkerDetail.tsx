import type { Marker } from '../types/marker';
import { formatMarkerDate, formatSubjectCodes } from '../utils/formatting';
import LearnMoreSection from '../components/LearnMoreSection';

interface MarkerDetailProps {
  marker: Marker;
  onBack: () => void;
}

export default function MarkerDetail({ marker, onBack }: MarkerDetailProps) {
  const directionsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`;

  return (
    <div className="marker-detail">
      <div className="marker-detail-header">
        <button className="back-button" aria-label="Back" onClick={onBack}>
          &larr;
        </button>
        <span className="marker-number">#{marker.markerNumber}</span>
        {marker.isRTHL && <span className="marker-badge rthl">RTHL</span>}
      </div>

      <h2 className="marker-detail-title">{marker.title}</h2>

      <div className="marker-detail-meta">
        <p className="marker-location">{marker.city}, {marker.county} County</p>
        {marker.markerDate && (
          <p className="marker-meta-item">{formatMarkerDate(marker.markerDate)}</p>
        )}
        {marker.size && (
          <p className="marker-meta-item">{marker.size}</p>
        )}
        {marker.subjectCodes.length > 0 && (
          <p className="marker-meta-item">{formatSubjectCodes(marker.subjectCodes)}</p>
        )}
      </div>

      {marker.markerText && (
        <div className="marker-detail-text">
          <h3>Inscription</h3>
          <p>{marker.markerText}</p>
        </div>
      )}

      <LearnMoreSection markerNumber={marker.markerNumber} />

      {marker.lat !== 0 && marker.lng !== 0 && (
        <div className="marker-detail-actions">
          <a
            className="directions-button"
            href={directionsUrl}
            aria-label="Get Directions"
          >
            Get Directions
          </a>
        </div>
      )}
    </div>
  );
}
