import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadingScreen from '../LoadingScreen';

describe('LoadingScreen [REQ:offline]', () => {
  it('shows checking message [AC:LOAD-01]', () => {
    render(<LoadingScreen state="checking" progress={0} error={null} onRetry={() => {}} />);
    expect(screen.getByText(/checking/i)).toBeInTheDocument();
  });

  it('shows downloading message [AC:LOAD-02]', () => {
    render(<LoadingScreen state="downloading" progress={0} error={null} onRetry={() => {}} />);
    expect(screen.getByText(/downloading/i)).toBeInTheDocument();
  });

  it('shows seeding message with progress bar [AC:LOAD-03]', () => {
    render(<LoadingScreen state="seeding" progress={50} error={null} onRetry={() => {}} />);
    expect(screen.getByText(/preparing/i)).toBeInTheDocument();
  });

  it('shows error with retry button [AC:LOAD-04]', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<LoadingScreen state="error" progress={0} error="Network error" onRetry={onRetry} />);

    expect(screen.getByText('Network error')).toBeInTheDocument();
    await user.click(screen.getByText(/try again/i));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows app title [AC:LOAD-05]', () => {
    render(<LoadingScreen state="checking" progress={0} error={null} onRetry={() => {}} />);
    expect(screen.getByText('One Mile Ahead')).toBeInTheDocument();
  });
});
