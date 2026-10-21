import { useState } from 'react';
import { useMarkerResearch } from '../hooks/useMarkerResearch';
import LearnMoreLink from './LearnMoreLink';

interface LearnMoreSectionProps {
  markerNumber: string;
}

export default function LearnMoreSection({ markerNumber }: LearnMoreSectionProps) {
  const { research, loading, error } = useMarkerResearch(markerNumber);
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="learn-more-section">
        <div className="learn-more-loading">Loading related links...</div>
      </div>
    );
  }

  if (!research || error) {
    return null;
  }

  return (
    <div className="learn-more-section">
      <button
        className="learn-more-header"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span className="learn-more-title">Learn More</span>
        <span className="learn-more-count">{research.links.length}</span>
        <span className="learn-more-chevron">{collapsed ? '\u25B6' : '\u25BC'}</span>
      </button>
      <div
        className="learn-more-links"
        style={{ display: collapsed ? 'none' : 'block' }}
      >
        {research.links.map((link, i) => (
          <LearnMoreLink key={i} link={link} />
        ))}
      </div>
    </div>
  );
}
