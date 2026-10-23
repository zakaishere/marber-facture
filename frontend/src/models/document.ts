import type { FactureCompany } from './facturePrintModel';

export interface MarbleLine {
  id?: string;
  productId: string;
  product?: { id: string; name: string; code: string };
  length: number;
  width: number;
  dimensionUnit: 'CM' | 'M';
  quantity: number;
  surface?: number;
  totalSurface?: number;
  unitPriceTtc?: number;
  unitPrice?: number;
  tvaRate?: number;
  tvaPercent?: number;
  lineTotalHt?: number;
  lineTotalTva?: number;
  lineTotalTtc?: number;
  lineTotal?: number;
  subtotalAfter?: boolean;
}
export interface Party { id: string; name: string; phone?: string; address?: string; ice?: string }
export interface MarbleDocument {
  notes?: string | null;
  id: string; code: string; date: string; status: string; paymentMethod: string | null;
  clientId?: string; supplierId?: string; client?: Party; supplier?: Party; company?: FactureCompany; printCompany?: FactureCompany;
  items: MarbleLine[]; totalHt: number; totalTva: number; totalTtc?: number; totalAmount?: number;
  paidAmount: number; remainingAmount: number; paymentStatus: string; createdAt: string; updatedAt: string;
}
export interface DocumentPayment { id: string; amount: number; method: string; date: string; note?: string }
