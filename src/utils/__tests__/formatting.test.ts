import { describe, it, expect } from 'vitest';
import { formatMarkerDate, formatSubjectCodes, truncateText } from '../formatting';

describe('formatMarkerDate [REQ:utilities]', () => {
  it('returns year as-is for simple year [AC:FMT-01]', () => {
    expect(formatMarkerDate('1970')).toBe('1970');
  });

  it('returns empty string for empty input [AC:FMT-02]', () => {
    expect(formatMarkerDate('')).toBe('');
  });

  it('handles date strings with extra whitespace [AC:FMT-03]', () => {
    expect(formatMarkerDate('  1985  ')).toBe('1985');
  });

  it('passes through full date strings [AC:FMT-04]', () => {
    expect(formatMarkerDate('March 15, 1936')).toBe('March 15, 1936');
  });
});

describe('formatSubjectCodes [REQ:utilities]', () => {
  it('joins codes with commas [AC:FMT-05]', () => {
    expect(formatSubjectCodes(['buildings', 'churches'])).toBe('Buildings, Churches');
  });

  it('capitalizes first letter of each code [AC:FMT-06]', () => {
    expect(formatSubjectCodes(['oil'])).toBe('Oil');
  });

  it('returns empty string for empty array [AC:FMT-07]', () => {
    expect(formatSubjectCodes([])).toBe('');
  });

  it('handles multi-word codes [AC:FMT-08]', () => {
    expect(formatSubjectCodes(['african american history'])).toBe('African American History');
  });
});

describe('truncateText [REQ:utilities]', () => {
  it('returns short text unchanged [AC:FMT-09]', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
  });

  it('truncates long text with ellipsis [AC:FMT-10]', () => {
    const result = truncateText('This is a very long text', 10);
    // slice(0, 10) = "This is a " (includes trailing space)
    expect(result).toBe('This is a \u2026');
    expect(result.length).toBeLessThanOrEqual(11); // 10 chars + ellipsis
  });

  it('returns empty string for empty input [AC:FMT-11]', () => {
    expect(truncateText('', 10)).toBe('');
  });

  it('handles exact length text [AC:FMT-12]', () => {
    expect(truncateText('1234567890', 10)).toBe('1234567890');
  });
});
