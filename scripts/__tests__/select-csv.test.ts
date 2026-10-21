import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { selectLatestCsv } from '../prepare-data';

/** Handoff §4.2: with dated exports side by side, the pipeline must read the newest one. */
describe('selectLatestCsv [data-pipeline: CSV choice]', () => {
  let dir: string;
  const touch = (...names: string[]) => names.forEach((n) => writeFileSync(join(dir, n), 'MarkerNum\n1\n'));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'oma-csv-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('picks the file with the latest YYYY-MM-DD in its name, not the first by name', () => {
    // The old export sorts first by name; the pipeline used to read csvFiles[0].
    touch('historical_markers_2026-02-28.csv', 'historical_markers_2026-10-13.csv');
    expect(selectLatestCsv(dir)).toBe(join(dir, 'historical_markers_2026-10-13.csv'));
  });

  it('compares dates, whatever the rest of the name is', () => {
    touch('a_thc_2025-12-31.csv', 'b_export_2026-01-02.csv', 'c_old_2024-06-30.csv');
    expect(selectLatestCsv(dir)).toBe(join(dir, 'b_export_2026-01-02.csv'));
  });

  it('ignores files that are not .csv', () => {
    touch('historical_markers_2026-02-28.csv', 'notes_2027-01-01.txt', '.gitkeep');
    expect(selectLatestCsv(dir)).toBe(join(dir, 'historical_markers_2026-02-28.csv'));
  });

  it('fails if any CSV has no date in its name', () => {
    touch('historical_markers_2026-10-13.csv', 'HistoricalMarkers.csv');
    expect(() => selectLatestCsv(dir)).toThrow(/HistoricalMarkers\.csv.*YYYY-MM-DD/);
  });

  it('fails if two CSVs share the latest date', () => {
    touch('thc_2026-10-13.csv', 'thc_copy_2026-10-13.csv', 'thc_2026-02-28.csv');
    expect(() => selectLatestCsv(dir)).toThrow(/2026-10-13/);
  });

  it('fails if two CSVs share any date', () => {
    touch('thc_2026-10-13.csv', 'a_2026-02-28.csv', 'b_2026-02-28.csv');
    expect(() => selectLatestCsv(dir)).toThrow(/2026-02-28/);
  });

  it('fails on an impossible date', () => {
    touch('thc_2026-02-30.csv');
    expect(() => selectLatestCsv(dir)).toThrow(/2026-02-30/);
  });

  it('fails if there is no CSV', () => {
    touch('readme.txt');
    expect(() => selectLatestCsv(dir)).toThrow(/No CSV files/);
  });
});
