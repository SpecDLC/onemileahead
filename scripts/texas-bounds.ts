// Texas geographic bounds with a small buffer.
// Lives outside scripts/skills so the public export can map coordinates
// while the agent tooling under scripts/skills stays private.
export const TEXAS_BOUNDS = {
  latMin: 25.5,
  latMax: 36.8,
  lngMin: -106.9,
  lngMax: -93.2,
};
