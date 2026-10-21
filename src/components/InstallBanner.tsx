import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function InstallBanner() {
  const { canInstall, install } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="install-banner">
      <span>Install for quick access</span>
      <button className="install-button" onClick={install}>
        Install
      </button>
    </div>
  );
}
