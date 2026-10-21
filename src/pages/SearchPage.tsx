import { useState } from 'react';
import SearchInput from '../components/SearchInput';
import MarkerCard from '../components/MarkerCard';
import FeaturedMarkerCard from '../components/FeaturedMarkerCard';
import { useMarkerSearch } from '../hooks/useMarkerSearch';
import { useFeaturedMarkers } from '../hooks/useFeaturedMarkers';
import type { Marker } from '../types/marker';

interface SearchPageProps {
  onSelectMarker: (marker: Marker) => void;
}

export default function SearchPage({ onSelectMarker }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useMarkerSearch(query);
  const { featured } = useFeaturedMarkers();

  const hasQuery = query.trim().length > 0;
  const showEmpty = hasQuery && !isLoading && results.length === 0;
  const showFeatured = !hasQuery && featured.length > 0;

  return (
    <div className="search-page">
      <SearchInput value={query} onChange={setQuery} autoFocus />
      <div className="search-results">
        {isLoading && <p className="search-status">Searching...</p>}
        {showEmpty && <p className="search-status">No markers found</p>}
        {showFeatured && (
          <div className="featured-section">
            <h2 className="featured-heading">Featured Markers</h2>
            {featured.map(({ marker, research }) => (
              <FeaturedMarkerCard
                key={marker.id}
                marker={marker}
                research={research}
                onClick={onSelectMarker}
              />
            ))}
          </div>
        )}
        {results.map((marker) => (
          <MarkerCard
            key={marker.id}
            marker={marker}
            onClick={onSelectMarker}
          />
        ))}
      </div>
    </div>
  );
}
