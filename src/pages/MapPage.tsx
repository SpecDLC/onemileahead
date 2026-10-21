import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { db } from '../db/database';
import type { Marker as MarkerType } from '../types/marker';

// Fix Leaflet default icon paths (broken by bundlers)
// @ts-expect-error - Leaflet icon fix for bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPageProps {
  onSelectMarker: (marker: MarkerType) => void;
}

// Texas center
const DEFAULT_CENTER: [number, number] = [31.0, -100.0];
const DEFAULT_ZOOM = 6;

/**
 * Popup body for a pin. Built from DOM nodes so marker text is never parsed as HTML.
 * Click, Enter, or Space opens the marker.
 */
function popupContent(m: MarkerType, onSelectMarker: (m: MarkerType) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'marker-popup-body';
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  const title = document.createElement('strong');
  title.textContent = m.title;
  el.append(title, document.createElement('br'), `#${m.markerNumber}`);
  const open = () => onSelectMarker(m);
  el.addEventListener('click', open);
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  });
  return el;
}

/** Adds clustered markers to the map using the Leaflet API directly (no React per-marker) */
function ClusterLayer({ onSelectMarker }: { onSelectMarker: (m: MarkerType) => void }) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      disableClusteringAtZoom: 14,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);

    db.markers
      .filter((m) => m.lat !== 0 && m.lng !== 0)
      .toArray()
      .then((markers) => {
        if (cancelled) return;
        const leafletMarkers = markers.map((m) =>
          L.marker([m.lat, m.lng]).bindPopup(() => popupContent(m, onSelectMarker)),
        );
        cluster.addLayers(leafletMarkers);
      });

    return () => {
      cancelled = true;
      map.removeLayer(cluster);
    };
  }, [map, onSelectMarker]);

  return null;
}

export default function MapPage({ onSelectMarker }: MapPageProps) {
  return (
    <div className="map-page">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterLayer onSelectMarker={onSelectMarker} />
      </MapContainer>
    </div>
  );
}
