/**
 * An amount spelled out, for the line every memo in this country carries under
 * its total.
 *
 * Grouped the way Bangladesh counts - hazar, lakh, koti - not in millions. The
 * words stay English, as they are on a printed cash memo here, but the grouping
 * has to be local or the figure and the words disagree: 150,000 is "One Lakh
 * Fifty Thousand", never "One Hundred Fifty Thousand".
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0-99. Hyphenated above twenty, as "Seventy-Five" is written on a memo. */
function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens}-${ones}` : tens;
}

/** 0-999. */
function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(' ');
}

/** A whole number in words, grouped koti / lakh / hazar. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';

  const parts: string[] = [];
  const koti = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const hazar = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  // Beyond a hundred crore the count itself is spelled out and then labelled,
  // which is how the scale keeps working: "One Hundred Twenty Crore".
  if (koti) parts.push(`${numberToWords(koti)} Crore`);
  if (lakh) parts.push(`${underHundred(lakh)} Lakh`);
  if (hazar) parts.push(`${underHundred(hazar)} Thousand`);
  if (rest) parts.push(underThousand(rest));

  return parts.join(' ');
}

/**
 * The full line as printed: "Fifty-Nine Thousand Three Hundred Seventy-Five
 * Taka Only", with paisa named separately when there are any.
 *
 * Paisa are spoken, not shown as a decimal - a memo that reads "and 50/100" is
 * a figure repeated, not an amount written out.
 */
export function takaInWords(paisa: number): string {
  const negative = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const taka = Math.floor(abs / 100);
  const poisha = abs % 100;

  const parts: string[] = [];
  if (taka || !poisha) parts.push(`${numberToWords(taka)} Taka`);
  if (poisha) parts.push(`${taka ? 'and ' : ''}${underHundred(poisha)} Paisa`);

  // A negative total is a credit note, and saying so is clearer than a minus
  // sign the reader has to spot in a line of words.
  return `${negative ? 'Minus ' : ''}${parts.join(' ')} Only`;
}
