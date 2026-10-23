import http from './http';

export interface Facture {
  notes?: string | null;
  company?: import('@/models/facturePrintModel').FactureCompany;
  /** Current issuer settings for printing; company remains the historical snapshot. */
  printCompany?: import('@/models/facturePrintModel').FactureCompany;
  paidAmount?: number;
  remainingAmount?: number;
  id: string;
  code: string;
  date: string;
  clientId: string;
  status: 'DECLARED' | 'NOT_DECLARED';
  paymentMethod?: 'CHEQUE' | 'ESPECE' | 'LCN' | 'VIREMENT' | null;
  client?: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    ice?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  items?: FactureLine[];
  createdAt: string;
  updatedAt: string;
}

export interface FactureLine {
  length?: number;
  width?: number;
  dimensionUnit?: 'CM' | 'M';
  surface?: number;
  totalSurface?: number;
  subtotalAfter?: boolean;
  id: string;
  factureId: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    code: string;
  };
  quantity: number;
  unitPriceTtc: number;
  tvaRate: number;
  lineTotalHt: number;
  lineTotalTva: number;
  lineTotalTtc: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFactureDto {
  notes?: string;
  clientId: string;
  date?: string;
  code?: string;
  status?: 'DECLARED' | 'NOT_DECLARED';
  paymentMethod?: 'CHEQUE' | 'ESPECE' | 'LCN' | 'VIREMENT' | null;
  items: {
    productId: string;
    quantity: number;
    unitPriceTtc: number;
    tvaPercent?: number;
  }[];
}

export interface UpdateFactureDto {
  notes?: string;
  clientId?: string;
  date?: string;
  code?: string;
  status?: 'DECLARED' | 'NOT_DECLARED';
  paymentMethod?: 'CHEQUE' | 'ESPECE' | 'LCN' | 'VIREMENT' | null;
  items?: {
    productId: string;
    quantity: number;
    unitPriceTtc: number;
    tvaPercent?: number;
  }[];
}

export const getFactures = async (params?: {
  search?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'DECLARED' | 'NOT_DECLARED';
  paymentMethod?: string;
  minTtc?: number | string;
  maxTtc?: number | string;
  minHt?: number | string;
  maxHt?: number | string;
  page?: number;
  pageSize?: number;
  sortBy?: 'code' | 'date' | 'totalTtc' | 'totalHt' | 'totalTva' | 'status' | 'paymentMethod' | 'client';
  sortOrder?: 'ASC' | 'DESC';
  includeItems?: boolean;
  paged?: boolean;
}) => {
  const response = await http.get<Facture[]>('/factures', { params });
  return response.data;
};

export const getFacture = async (id: string) => {
  const response = await http.get<Facture>(`/factures/${id}`);
  return response.data;
};

export const getFactureByCode = async (code: string) => {
  const response = await http.get<Facture>(`/factures/by-code/${code}`);
  return response.data;
};

export const createFacture = async (data: CreateFactureDto) => {
  const response = await http.post<Facture>('/factures', data);
  return response.data;
};

export const updateFacture = async (id: string, data: UpdateFactureDto) => {
  const response = await http.put<Facture>(`/factures/${id}`, data);
  return response.data;
};

export const deleteFacture = async (id: string) => {
  await http.delete(`/factures/${id}`);
};
