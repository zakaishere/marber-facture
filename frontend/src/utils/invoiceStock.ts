import type { MarbleLine } from '@/models/document';
import { lineAmounts } from './marble';

export interface LineStock {
  known: boolean;
  requested: number;
  available: number;
  remaining: number;
  maxPieces: number | null;
  exceeds: boolean;
  canDuplicate: boolean;
}

/** Allocate the available surface once, in row order, including repeated articles and subtotal groups. */
export function invoiceStock(lines: MarbleLine[], products: { id: string; quantity: number }[], original: MarbleLine[] = []): LineStock[] {
  const credits = new Map<string, bigint>();
  for (const line of original) credits.set(line.productId, (credits.get(line.productId) || 0n) + lineAmounts(line).totalMicro);
  const capacity = new Map<string, bigint>();
  for (const product of products) {
    const quantity = Number(product.quantity);
    if (!Number.isFinite(quantity)) continue;
    // An existing invoice has already consumed its own surface. Restore it for editing.
    // If history is negative, the backend permits keeping/reducing the original sale, never increasing it.
    const available = BigInt(Math.max(0, quantity).toFixed(6).replace('.', ''));
    capacity.set(product.id, available + (credits.get(product.id) || 0n));
  }
  const requested = lines.map(line => lineAmounts(line));
  const totals = new Map<string, bigint>();
  lines.forEach((line, index) => totals.set(line.productId, (totals.get(line.productId) || 0n) + requested[index].totalMicro));
  const used = new Map<string, bigint>();
  return lines.map((line, index) => {
    const known = capacity.has(line.productId);
    const limit = capacity.get(line.productId) || 0n;
    const before = limit - (used.get(line.productId) || 0n);
    const available = before > 0n ? before : 0n;
    const { totalMicro, surfaceMicro } = requested[index];
    used.set(line.productId, (used.get(line.productId) || 0n) + totalMicro);
    const after = available - totalMicro;
    return {
      known, requested: Number(totalMicro) / 1e6, available: Number(available) / 1e6,
      remaining: Number(after > 0n ? after : 0n) / 1e6,
      maxPieces: surfaceMicro > 0n ? Number(available / surfaceMicro) : null,
      exceeds: !!line.productId && (!known || totalMicro > available),
      canDuplicate: known && totalMicro <= limit - (totals.get(line.productId) || 0n),
    };
  });
}
