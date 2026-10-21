import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock useDataLoader to skip the loading screen
vi.mock('../hooks/useDataLoader', () => ({
  useDataLoader: () => ({
    state: 'ready',
    progress: 100,
    error: null,
  }),
}));

// Mock useInstallPrompt (no install prompt in test env)
vi.mock('../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    canInstall: false,
    isInstalled: false,
    install: vi.fn(),
  }),
}));

describe('App', () => {
  it('renders the app header', () => {
    render(<App />);
    expect(screen.getByText('One Mile Ahead')).toBeInTheDocument();
  });

  it('shows search tab as default active tab', () => {
    render(<App />);
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toHaveClass('active');
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const mapButton = screen.getByRole('button', { name: /map/i });
    await user.click(mapButton);
    expect(mapButton).toHaveClass('active');

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).not.toHaveClass('active');
  });

  it('shows the Ahead tab when the query string is empty', () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(window.location.search).toBe('');
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^map$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^nearby$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ahead$/i })).toBeInTheDocument();
  });
});
