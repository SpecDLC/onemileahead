export type LinkSource = 'grokipedia' | 'wikipedia' | 'curated';

export interface ResearchLink {
  title: string;
  url: string;
  source: LinkSource;
  description: string;
}

export interface MarkerResearch {
  markerNumber: string;
  generatedAt: string;
  links: ResearchLink[];
}

export interface ResearchManifest {
  version: number;
  generatedAt: string;
  markers: string[];
}
