import type { ResearchLink } from '../types/research';

const SOURCE_LABELS: Record<string, string> = {
  grokipedia: 'Grokipedia',
  wikipedia: 'Wikipedia',
  curated: 'Related',
};

interface LearnMoreLinkProps {
  link: ResearchLink;
}

export default function LearnMoreLink({ link }: LearnMoreLinkProps) {
  return (
    <a
      className={`learn-more-link source-${link.source}`}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className={`source-badge source-badge-${link.source}`}>
        {SOURCE_LABELS[link.source] || link.source}
      </span>
      <span className="learn-more-link-title">{link.title}</span>
      <span className="learn-more-link-desc">{link.description}</span>
    </a>
  );
}
