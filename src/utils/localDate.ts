/**
 * The local calendar day a Date falls on, as YYYY-MM-DD.
 *
 * Not `toISOString().split('T')[0]`: that converts to UTC first, and Bangladesh
 * runs six hours ahead, so for the first six hours of every local day it names
 * the day before. A "Today" filter built that way asks for yesterday and matches
 * nothing. This mirrors localDateKey() in the main process, which is how the
 * reports group sales.
 */
export function toLocalDateString(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
