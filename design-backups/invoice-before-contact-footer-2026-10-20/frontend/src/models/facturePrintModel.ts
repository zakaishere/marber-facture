export interface FactureItem {
  length?: number;
  width?: number;
  dimension_unit?: 'CM' | 'M';
  total_surface?: number;
  subtotal_after?: boolean;
  designation: string;
  quantity: number;
  unit_price_ttc: number;
  line_total_ttc: number;
  tva_rate_percent: number;
}

export interface FactureCompany {
  rib?: string;
  name: string;
  activity: string;
  address: string;
  phone_fix: string;
  phone_mobile: string;
  email?: string;
  rc?: string;
  if?: string;
  patente?: string;
  cnss?: string;
  ice?: string;
}

export interface FactureInvoiceInfo {
  title?: string;
  paid_amount?: number;
  date: string;             // "2025-05-27"
  number: string;           // "2550038"
  payment_mode: string;     // "LCN"
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  amount_to_pay: number;
  amount_in_words?: string; // "QUARANTE-DEUX MILLE SIX CENT TRENTE-DEUX DHS"
}

export interface FactureClient {
  name: string;
  city: string;
  ice: string;
}

export interface FacturePrintModel {
  company: FactureCompany;
  invoice: FactureInvoiceInfo;
  client: FactureClient;
  currency: string;     // "MAD"
  items: FactureItem[];
}

