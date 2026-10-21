import type { LoadState } from '../hooks/useDataLoader';

interface LoadingScreenProps {
  state: LoadState;
  progress: number;
  error: string | null;
  onRetry: () => void;
}

function getMessage(state: LoadState): string {
  switch (state) {
    case 'checking': return 'Checking local data...';
    case 'downloading': return 'Downloading marker data...';
    case 'seeding': return 'Preparing offline database...';
    case 'error': return 'Something went wrong';
    default: return '';
  }
}

export default function LoadingScreen({ state, progress, error, onRetry }: LoadingScreenProps) {
  return (
    <div className="loading-screen">
      <h1 className="loading-title">One Mile Ahead</h1>
      <p className="loading-subtitle">Texas Historical Markers</p>
      <div className="loading-status">
        <p>{getMessage(state)}</p>
        {state === 'seeding' && (
          <div className="loading-progress">
            <div className="loading-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
        {state === 'error' && error && (
          <>
            <p className="loading-error">{error}</p>
            <button className="loading-retry" onClick={onRetry}>Try Again</button>
          </>
        )}
      </div>
    </div>
  );
}
