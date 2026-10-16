// Keep money in integer cents, including when correcting a previous installment.
export function paymentCents(value: string | number): bigint | null {
  const normalized = String(value).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function paymentDecimal(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
export function paymentError(value: string, maximum: bigint): string {
  if (!value.trim()) return '';
  const cents = paymentCents(value);
  if (cents === null) return 'Saisissez un montant valide avec au maximum deux décimales.';
  if (cents <= 0n) return 'Le versement doit être supérieur à zéro.';
  if (cents > maximum) return 'Le versement dépasse le reste à payer.';
  return '';
}
