import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LearnMoreLink from '../LearnMoreLink';
import type { ResearchLink } from '../../types/research';

const grokLink: ResearchLink = {
  title: 'Battle of the Alamo',
  url: 'https://grokipedia.com/article/Battle_of_the_Alamo',
  source: 'grokipedia',
  description: 'The Alamo mission was the site of the pivotal 1836 battle.',
};

const wikiLink: ResearchLink = {
  title: 'Alamo Mission',
  url: 'https://en.wikipedia.org/wiki/Alamo_Mission',
  source: 'wikipedia',
  description: 'An 18th-century mission that became a fortress.',
};

const curatedLink: ResearchLink = {
  title: 'The Alamo Official Site',
  url: 'https://www.thealamo.org',
  source: 'curated',
  description: 'Official website with virtual tours and visitor info.',
};

describe('LearnMoreLink', () => {
  it('renders link title', () => {
    render(<LearnMoreLink link={grokLink} />);
    expect(screen.getByText('Battle of the Alamo')).toBeInTheDocument();
  });

  it('renders link description', () => {
    render(<LearnMoreLink link={grokLink} />);
    expect(screen.getByText(/pivotal 1836 battle/)).toBeInTheDocument();
  });

  it('renders source badge for grokipedia', () => {
    render(<LearnMoreLink link={grokLink} />);
    expect(screen.getByText('Grokipedia')).toBeInTheDocument();
  });

  it('renders source badge for wikipedia', () => {
    render(<LearnMoreLink link={wikiLink} />);
    expect(screen.getByText('Wikipedia')).toBeInTheDocument();
  });

  it('renders source badge for curated', () => {
    render(<LearnMoreLink link={curatedLink} />);
    expect(screen.getByText('Related')).toBeInTheDocument();
  });

  it('opens link in new tab', () => {
    render(<LearnMoreLink link={grokLink} />);
    const anchor = screen.getByRole('link');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('sets correct href', () => {
    render(<LearnMoreLink link={grokLink} />);
    const anchor = screen.getByRole('link');
    expect(anchor).toHaveAttribute('href', 'https://grokipedia.com/article/Battle_of_the_Alamo');
  });
});
