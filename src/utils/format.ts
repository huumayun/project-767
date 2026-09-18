export function tk(amount: number): string {
  if (isNaN(amount)) return '0.00';
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
