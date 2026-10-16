import type { MarbleLine } from '@/models/document';

export const MARBLE_LIMITS = { dimension: 100000, pieces: 100000, price: 9999999999.99, total: 999999999999.99 };
export function lineInputError(line: MarbleLine, purchase = false): string | null {
  for (const [key, label] of [['length', 'Longueur'], ['width', 'Largeur']] as const) {
    const value = Number(line[key]);
    if (!Number.isFinite(value) || value < 0 || value > MARBLE_LIMITS.dimension) return `${label} : valeur positive, maximum 100 000 ${line.dimensionUnit === 'CM' ? 'cm' : 'm'}.`;
    if (Number(value.toFixed(3)) !== value) return `${label} : 3 décimales maximum.`;
  }
  const pieces = Number(line.quantity);
  if (!Number.isInteger(pieces) || pieces < 1 || pieces > MARBLE_LIMITS.pieces) return 'PCS : un nombre entier entre 1 et 100 000.';
  const price = Number((purchase ? line.unitPrice : line.unitPriceTtc) ?? 0);
  if (!Number.isFinite(price) || price < 0 || price > MARBLE_LIMITS.price) return 'Prix TTC/m² : maximum 9 999 999 999,99 MAD, valeur positive.';
  if (Number(price.toFixed(2)) !== price) return 'Prix TTC/m² : 2 décimales maximum.';
  return null;
}

// Fixed-point preview: dimensions have 3 decimals, area has 6, amounts have 2.
// Spring recalculates every saved amount and remains authoritative.
function fixed(value: number, scale: number): bigint {
  if (!Number.isFinite(value) || value < 0) return 0n;
  return BigInt(value.toFixed(scale).replace('.', ''));
}
const roundDivide = (n: bigint, d: bigint) => (n + d / 2n) / d;
export function lineAmounts(line: MarbleLine, purchase = false) {
  if (lineInputError(line, purchase)) return { surfaceMicro: 0n, totalMicro: 0n, surface: 0, totalSurface: 0, ht: 0, tva: 0, ttc: 0 };
  const length = fixed(Number(line.length), 3);
  const width = fixed(Number(line.width), 3);
  const divisor = line.dimensionUnit === 'CM' ? 10000n : 1n;
  const surfaceMicro = roundDivide(length * width, divisor);
  const pieces = BigInt(Math.max(0, Math.trunc(Number(line.quantity) || 0)));
  const totalMicro = surfaceMicro * pieces;
  const price = fixed(Number(purchase ? line.unitPrice : line.unitPriceTtc), 2);
  const percent = fixed(Number(line.tvaPercent ?? Number(line.tvaRate ?? .2) * 100), 3);
  const ttc = roundDivide(totalMicro * price, 1000000n);
  const ht = roundDivide(ttc * 100000n, 100000n + percent);
  return { surfaceMicro, totalMicro, surface: Number(surfaceMicro) / 1e6, totalSurface: Number(totalMicro) / 1e6, ht: Number(ht) / 100, tva: Number(ttc - ht) / 100, ttc: Number(ttc) / 100 };
}
export const area = (value: number) => Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
export const paymentLabel = (method?: string | null) => ({ ESPECE: 'Espèces', CASH: 'Espèces', VIREMENT: 'Virement', BANK_TRANSFER: 'Virement', CHEQUE: 'Chèque', CHECK: 'Chèque', LCN: 'LCN', CREDIT_CARD: 'Carte' }[method || ''] || 'Non précisé');
