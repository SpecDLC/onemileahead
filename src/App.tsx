import { useState, lazy, Suspense } from 'react';
import SearchPage from './pages/SearchPage';
import MarkerDetail from './pages/MarkerDetail';
import NearbyPage from './pages/NearbyPage';
import AheadPage from './pages/AheadPage';
import { isWasmEngineEnabled } from './engine/flag';
import LoadingScreen from './components/LoadingScreen';
import InstallBanner from './components/InstallBanner';
import SettingsDrawer from './components/SettingsDrawer';
import { useDataLoader } from './hooks/useDataLoader';
import type { Marker } from './types/marker';

// Lazy load MapPage since Leaflet is heavy
const MapPage = lazy(() => import('./pages/MapPage'));

type Tab = 'search' | 'map' | 'nearby' | 'ahead';

// ?engine=wasm: prototype Rust/WASM engine, which adds the Ahead tab.
const SHOW_AHEAD = isWasmEngineEnabled();

export default function App() {
  const { state: loadState, progress, error } = useDataLoader();
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (loadState !== 'ready') {
    return (
      <div className="app">
        <LoadingScreen
          state={loadState}
          progress={progress}
          error={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (selectedMarker) {
    return (
      <div className="app">
        <main className="app-content">
          <MarkerDetail
            marker={selectedMarker}
            onBack={() => setSelectedMarker(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>One Mile Ahead</h1>
        <button
          className="settings-gear"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          &#9881;
        </button>
      </header>
      <InstallBanner />
      <main className="app-content">
        {activeTab === 'search' && <SearchPage onSelectMarker={setSelectedMarker} />}
        {activeTab === 'map' && (
          <Suspense fallback={<div className="search-status">Loading map...</div>}>
            <MapPage onSelectMarker={setSelectedMarker} />
          </Suspense>
        )}
        {activeTab === 'nearby' && <NearbyPage onSelectMarker={setSelectedMarker} />}
        {activeTab === 'ahead' && SHOW_AHEAD && <AheadPage onSelectMarker={setSelectedMarker} />}
      </main>
      <nav className="tab-bar">
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          Map
        </button>
        <button
          className={`tab-button ${activeTab === 'nearby' ? 'active' : ''}`}
          onClick={() => setActiveTab('nearby')}
        >
          Nearby
        </button>
        {SHOW_AHEAD && (
          <button
            className={`tab-button ${activeTab === 'ahead' ? 'active' : ''}`}
            onClick={() => setActiveTab('ahead')}
          >
            Ahead
          </button>
        )}
      </nav>
      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
