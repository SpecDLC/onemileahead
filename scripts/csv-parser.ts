/**
 * Simple RFC 4180 CSV parser that handles:
 * - Quoted fields containing commas, newlines, and double-quotes
 * - Double-quote escaping (two "" = one ")
 * - Mixed line endings (CRLF, LF, CR)
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;

  while (i < text.length) {
    const row: string[] = [];

    while (i < text.length) {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < text.length) {
          if (text[i] === '"') {
            if (i + 1 < text.length && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
      } else {
        // Unquoted field
        let field = '';
        while (
          i < text.length &&
          text[i] !== ',' &&
          text[i] !== '\n' &&
          text[i] !== '\r'
        ) {
          field += text[i];
          i++;
        }
        row.push(field);
      }

      if (i < text.length && text[i] === ',') {
        i++; // skip comma, continue to next field
      } else {
        break; // end of row
      }
    }

    // Skip line endings
    if (i < text.length && text[i] === '\r') i++;
    if (i < text.length && text[i] === '\n') i++;

    if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse CSV into array of objects using header row as keys.
 */
export function parseCSVToObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i] || '';
    }
    return obj;
  });
}
