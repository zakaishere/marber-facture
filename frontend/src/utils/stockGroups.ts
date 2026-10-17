import type { Product } from '../api/products';

function scaled(value: string | number, precision: number): bigint {
  const text = String(value ?? 0);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const result = BigInt(whole) * (10n ** BigInt(precision)) + BigInt(fraction.padEnd(precision, '0').slice(0, precision));
  return negative ? -result : result;
}

export function stockGroups(products: Product[]) {
  const groups = new Map<string, { id: string; name: string; products: Product[]; dimensions: number; pieces: number; surface: bigint; purchase: bigint; sale: bigint }>();
  for (const product of products) {
    const id = product.categoryId;
    if (!groups.has(id)) groups.set(id, { id, name: product.category?.name || 'Sans catégorie', products: [], dimensions: 0, pieces: 0, surface: 0n, purchase: 0n, sale: 0n });
    const group = groups.get(id)!;
    group.products.push(product);
    group.dimensions += Number(product.dimensionCount ?? 0);
    group.pieces += Number(product.stockPieces ?? 0);
    group.surface += scaled(product.quantity, 6);
    group.purchase += scaled(product.purchaseStockValue ?? '0', 2);
    group.sale += scaled(product.saleStockValue ?? '0', 2);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// Sum exact decimal API values before formatting, including very large stock values.
export function stockTotal(value: bigint, precision: number, suffix = '') {
  const absolute = value < 0n ? -value : value;
  const divisor = 10n ** BigInt(precision);
  const digits = String(absolute % divisor).padStart(precision, '0');
  const fraction = suffix === ' MAD' ? digits : digits.replace(/0+$/, '');
  return `${value < 0n ? '−' : ''}${(absolute / divisor).toLocaleString('fr-FR')}${fraction ? ',' + fraction : ''}${suffix}`;
}
