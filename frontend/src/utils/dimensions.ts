import type { MarbleLine } from '@/models/document';

export function dimensionInCm(value: number | undefined, unit?: 'CM' | 'M'): number {
  return unit === 'M' ? Number((Number(value || 0) * 100).toFixed(3)) : Number(value || 0);
}

// Preserve old metre-based documents while editing all dimensions in centimetres.
export function lineInCm(line: MarbleLine): MarbleLine {
  return { ...line, length: dimensionInCm(line.length, line.dimensionUnit), width: dimensionInCm(line.width, line.dimensionUnit), dimensionUnit: 'CM' };
}
