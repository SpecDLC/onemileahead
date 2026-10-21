import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LearnMoreSection from '../LearnMoreSection';
import type { MarkerResearch } from '../../types/research';

const mockResearch: MarkerResearch = {
  markerNumber: '95',
  generatedAt: '2026-02-28',
  links: [
    {
      title: 'Battle of the Alamo',
      url: 'https://grokipedia.com/article/Battle_of_the_Alamo',
      source: 'grokipedia',
      description: 'The pivotal 1836 battle during the Texas Revolution.',
    },
    {
      title: 'Alamo Mission',
      url: 'https://en.wikipedia.org/wiki/Alamo_Mission',
      source: 'wikipedia',
      description: 'An 18th-century mission fortress.',
    },
  ],
};

vi.mock('../../hooks/useMarkerResearch', () => ({
  useMarkerResearch: vi.fn(),
}));

import { useMarkerResearch } from '../../hooks/useMarkerResearch';
const mockUseMarkerResearch = vi.mocked(useMarkerResearch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LearnMoreSection', () => {
  it('renders nothing when research is null', () => {
    mockUseMarkerResearch.mockReturnValue({
      research: null,
      loading: false,
      error: null,
    });

    const { container } = render(<LearnMoreSection markerNumber="999" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows loading state while fetching', () => {
    mockUseMarkerResearch.mockReturnValue({
      research: null,
      loading: true,
      error: null,
    });

    render(<LearnMoreSection markerNumber="95" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders section header with link count', () => {
    mockUseMarkerResearch.mockReturnValue({
      research: mockResearch,
      loading: false,
      error: null,
    });

    render(<LearnMoreSection markerNumber="95" />);
    expect(screen.getByText('Learn More')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders LearnMoreLink for each research link', () => {
    mockUseMarkerResearch.mockReturnValue({
      research: mockResearch,
      loading: false,
      error: null,
    });

    render(<LearnMoreSection markerNumber="95" />);
    expect(screen.getByText('Battle of the Alamo')).toBeInTheDocument();
    expect(screen.getByText('Alamo Mission')).toBeInTheDocument();
  });

  it('collapses on header click', async () => {
    const user = userEvent.setup();
    mockUseMarkerResearch.mockReturnValue({
      research: mockResearch,
      loading: false,
      error: null,
    });

    render(<LearnMoreSection markerNumber="95" />);
    // Links visible initially
    expect(screen.getByText('Battle of the Alamo')).toBeVisible();

    // Click header to collapse
    await user.click(screen.getByText('Learn More'));
    expect(screen.queryByText('Battle of the Alamo')).not.toBeVisible();

    // Click again to expand
    await user.click(screen.getByText('Learn More'));
    expect(screen.getByText('Battle of the Alamo')).toBeVisible();
  });

  it('renders nothing when no research and not loading', () => {
    mockUseMarkerResearch.mockReturnValue({
      research: null,
      loading: false,
      error: 'some error',
    });

    const { container } = render(<LearnMoreSection markerNumber="95" />);
    expect(container.innerHTML).toBe('');
  });
});
