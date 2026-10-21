import type { Marker } from '../types/marker';
import type { MarkerResearch } from '../types/research';

const SOURCE_LABELS: Record<string, string> = {
  grokipedia: 'Grokipedia',
  wikipedia: 'Wikipedia',
  curated: 'Related',
};

interface FeaturedMarkerCardProps {
  marker: Marker;
  research: MarkerResearch;
  onClick: (marker: Marker) => void;
}

export default function FeaturedMarkerCard({ marker, research, onClick }: FeaturedMarkerCardProps) {
  const topLinks = research.links.slice(0, 3);

  return (
    <article className="featured-card" onClick={() => onClick(marker)}>
      <div className="featured-card-header">
        <span className="marker-number">#{marker.markerNumber}</span>
        <span className="featured-badge">Featured</span>
      </div>
      <h3 className="featured-card-title">{marker.title}</h3>
      <p className="marker-location">
        {marker.city}, {marker.county} County
      </p>
      <div className="featured-links">
        {topLinks.map((link) => (
          <div key={link.url} className="featured-link-item">
            <span className={`source-badge source-badge-${link.source}`}>
              {SOURCE_LABELS[link.source] || link.source}
            </span>
            <span className="featured-link-title">{link.title}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
