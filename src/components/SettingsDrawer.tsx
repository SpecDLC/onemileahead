import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const { canInstall, isInstalled, install } = useInstallPrompt();

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            &times;
          </button>
        </div>

        <div className="settings-content">
          {canInstall && (
            <div className="settings-section">
              <h3>Install App</h3>
              <p className="settings-description">
                Add One Mile Ahead to your home screen for quick access and offline use.
              </p>
              <button className="install-button" onClick={install}>
                Install App
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="settings-section">
              <p className="settings-installed">App installed</p>
            </div>
          )}

          <div className="settings-section">
            <h3>About</h3>
            <p className="settings-description">
              One Mile Ahead helps you discover Texas Historical Markers while
              driving. Look up any marker by the number on the highway sign, or
              browse nearby markers with GPS.
            </p>
          </div>

          <div className="settings-section">
            <h3>Data</h3>
            <p className="settings-description">
              Marker data from the Texas Historical Commission Atlas.
              All 17,000+ markers are stored offline on your device.
            </p>
            <button
              className="settings-action"
              onClick={() => {
                indexedDB.deleteDatabase('OneMileAheadDB');
                window.location.reload();
              }}
            >
              Re-download Data
            </button>
          </div>

          <div className="settings-section settings-footer">
            <p className="settings-version">One Mile Ahead v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
