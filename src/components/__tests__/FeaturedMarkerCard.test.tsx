import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeaturedMarkerCard from '../FeaturedMarkerCard';
import type { Marker } from '../../types/marker';
import type { MarkerResearch } from '../../types/research';

const marker: Marker = {
  id: 42,
  markerNumber: '95',
  title: 'Alamo Cenotaph',
  county: 'Bexar',
  city: 'San Antonio',
  lat: 29.426,
  lng: -98.486,
  markerText: 'Historic monument text',
  markerDate: '1940',
  subjectCodes: ['military'],
  isRTHL: true,
  size: '18" x 28"',
};

const research: MarkerResearch = {
  markerNumber: '95',
  generatedAt: '2026-02-28',
  links: [
    {
      title: 'Battle of the Alamo',
      url: 'https://grokipedia.com/article/Battle_of_the_Alamo',
      source: 'grokipedia',
      description: 'The Alamo was the site of the pivotal 1836 battle.',
    },
    {
      title: 'Alamo Cenotaph',
      url: 'https://en.wikipedia.org/wiki/Alamo_Cenotaph',
      source: 'wikipedia',
      description: 'This monument honors the fallen defenders.',
    },
    {
      title: 'The Alamo Official Site',
      url: 'https://www.thealamo.org',
      source: 'curated',
      description: 'Official site with visitor information.',
    },
    {
      title: 'Fourth Link',
      url: 'https://example.com/4',
      source: 'curated',
      description: 'This should not render.',
    },
  ],
};

describe('FeaturedMarkerCard', () => {
  it('renders marker title', () => {
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={() => {}} />);
    expect(screen.getByText('Alamo Cenotaph', { selector: '.featured-card-title' })).toBeInTheDocument();
  });

  it('renders marker number', () => {
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={() => {}} />);
    expect(screen.getByText('#95')).toBeInTheDocument();
  });

  it('renders location', () => {
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={() => {}} />);
    expect(screen.getByText(/San Antonio.*Bexar/)).toBeInTheDocument();
  });

  it('renders Featured badge', () => {
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={() => {}} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders up to 3 research link titles', () => {
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={() => {}} />);
    expect(screen.getByText('Battle of the Alamo')).toBeInTheDocument();
    expect(screen.getByText('Alamo Cenotaph', { selector: '.featured-link-title' })).toBeInTheDocument();
    expect(screen.getByText('The Alamo Official Site')).toBeInTheDocument();
    expect(screen.queryByText('Fourth Link')).not.toBeInTheDocument();
  });

  it('renders source badges for research links', () => {
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={() => {}} />);
    expect(screen.getByText('Grokipedia')).toBeInTheDocument();
    expect(screen.getByText('Wikipedia')).toBeInTheDocument();
    expect(screen.getByText('Related')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<FeaturedMarkerCard marker={marker} research={research} onClick={onClick} />);

    await user.click(screen.getByRole('article'));
    expect(onClick).toHaveBeenCalledWith(marker);
  });
});
