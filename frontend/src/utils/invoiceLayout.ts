import type { FactureItem } from '../models/facturePrintModel';

export type InvoicePrintRow = { type: 'item'; item: FactureItem } | { type: 'subtotal'; surface: number; amount: number };

/** Retain explicit subtotal boundaries across articles and use the backend's line amounts. */
export function buildInvoiceRows(items: FactureItem[]): InvoicePrintRow[] {
  const rows: InvoicePrintRow[] = [];
  let surface = 0, cents = 0;
  for (const item of items) {
    rows.push({ type: 'item', item });
    surface += item.total_surface || 0;
    cents += Math.round(item.line_total_ttc * 100);
    if (item.subtotal_after) {
      rows.push({ type: 'subtotal', surface, amount: cents / 100 });
      surface = 0; cents = 0;
    }
  }
  return rows;
}

/** Partition measured rows, keeping a subtotal beside its preceding article. Preview consumes no data. */
export function paginateInvoiceRows(rows: InvoicePrintRow[], heights: number[], normalCapacity: number, finalCapacity: number, continuationNormalCapacity = normalCapacity, continuationFinalCapacity = finalCapacity): number[] {
  const groups: { count: number; height: number }[] = [];
  rows.forEach((row, index) => {
    const height = Math.max(0, heights[index] || 0);
    if (row.type === 'subtotal' && groups.length) {
      groups[groups.length - 1].count++;
      groups[groups.length - 1].height += height;
    } else groups.push({ count: 1, height });
  });
  const pages: number[] = [];
  let cursor = 0, remaining = groups.reduce((sum, group) => sum + group.height, 0);
  while (cursor < groups.length) {
    const normal = pages.length ? continuationNormalCapacity : normalCapacity;
    const final = pages.length ? continuationFinalCapacity : finalCapacity;
    if (remaining <= final) {
      pages.push(groups.slice(cursor).reduce((sum, group) => sum + group.count, 0));
      break;
    }
    let used = 0, count = 0;
    while (cursor < groups.length && (count === 0 || (used + groups[cursor].height <= normal && cursor < groups.length - 1))) {
      const group = groups[cursor++]; used += group.height; remaining -= group.height; count += group.count;
    }
    pages.push(count);
    if (cursor === groups.length) pages.push(0); // A full final sheet needs a separate totals page.
  }
  return pages.length ? pages : [0];
}
