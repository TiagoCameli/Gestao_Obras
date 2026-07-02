/**
 * Parses a numeric string that may use comma as decimal separator.
 * Returns 0 if the value is not a valid number.
 */
export function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}
