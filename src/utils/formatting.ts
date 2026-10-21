/**
 * Format a marker date string for display.
 * Trims whitespace, passes through as-is otherwise.
 */
export function formatMarkerDate(date: string): string {
  return date.trim();
}

/**
 * Format subject codes for display.
 * Capitalizes each word and joins with commas.
 */
export function formatSubjectCodes(codes: string[]): string {
  if (codes.length === 0) return '';

  return codes
    .map((code) =>
      code
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    )
    .join(', ');
}

/**
 * Truncate text to a max length, adding ellipsis if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '\u2026';
}
