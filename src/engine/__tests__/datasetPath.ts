/// <reference types="node" />
import { join } from 'path';

/**
 * Where engine tooling finds the full marker dataset: the pipeline's output,
 * public/data/markers.json (gitignored; only on the machine that ran prepare-data), unless the
 * OMA_MARKERS environment variable names another file. The same rule is used by
 * scripts/assemble-demo.mjs, scripts/bench-engine.mjs and the Rust tests.
 */
export function markersPath(root: string): string {
  return process.env.OMA_MARKERS || join(root, 'public', 'data', 'markers.json');
}
