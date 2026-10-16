import http from './http';

export interface Payment {
  id: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD';
  date: string;
  clientId?: string;
  supplierId?: string;
  bonAchatId?: string;
  note?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

export type BonAchatStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type BonPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD';

export interface BonAchat {
  id: string;
  code: string;
  date: string;
  status: BonAchatStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: BonPaymentMethod;
  supplierId: string;
  supplier?: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  items?: BonAchatLine[];
  createdAt: string;
  updatedAt: string;
}

export interface BonAchatLine {
  id: string;
  bonAchatId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBonAchatDto {
  supplierId: string;
  date?: string;
  code?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface UpdateBonAchatDto {
  supplierId?: string;
  items?: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export const getBonAchats = async (params?: {
  search?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: BonAchatStatus;
  paymentMethod?: string;
  minAmount?: number | string;
  maxAmount?: number | string;
  sortBy?: 'code' | 'date' | 'totalAmount' | 'status' | 'paymentMethod' | 'supplier';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
  pageSize?: number;
  includeItems?: boolean;
  paged?: boolean;
}) => {
  const response = await http.get<BonAchat[]>('/bon-achat', { params });
  return response.data;
};

export const getBonAchat = async (id: string) => {
  const response = await http.get<BonAchat>(`/bon-achat/${id}`);
  return response.data;
};

export const getBonAchatByCode = async (code: string) => {
  const response = await http.get<BonAchat>(`/bon-achat/by-code/${code}`);
  return response.data;
};

export const createBonAchat = async (data: CreateBonAchatDto) => {
  const response = await http.post<BonAchat>('/bon-achat', data);
  return response.data;
};

export const updateBonAchat = async (id: string, data: UpdateBonAchatDto) => {
  const response = await http.put<BonAchat>(`/bon-achat/${id}`, data);
  return response.data;
};

export const deleteBonAchat = async (id: string) => {
  await http.delete(`/bon-achat/${id}`);
};

export const recordPayment = async (id: string, amount: number, paymentMethod?: string) => {
  const response = await http.patch<BonAchat>(`/bon-achat/${id}/payment`, {
    amount,
    paymentMethod,
  });
  return response.data;
};

// Payment History API Functions
export const getBonAchatPayments = async (id: string): Promise<Payment[]> => {
  const response = await http.get<Payment[]>(`/bon-achat/${id}/payments`);
  return response.data;
};

export const addBonAchatPayment = async (
  id: string,
  data: { amount: number; method: Payment['method']; note?: string; date?: string }
): Promise<{ bon: BonAchat; payment: Payment }> => {
  const response = await http.post<{ bon: BonAchat; payment: Payment }>(
    `/bon-achat/${id}/payments`,
    data
  );
  return response.data;
};

export const updateBonAchatPayment = async (
  id: string,
  paymentId: string,
  data: { amount?: number; method?: Payment['method']; date?: string; note?: string }
): Promise<{ bon: BonAchat; payment: Payment }> => {
  const response = await http.put<{ bon: BonAchat; payment: Payment }>(
    `/bon-achat/${id}/payments/${paymentId}`,
    data
  );
  return response.data;
};

export const deleteBonAchatPayment = async (
  id: string,
  paymentId: string
): Promise<{ bon: BonAchat; message: string }> => {
  const response = await http.delete<{ bon: BonAchat; message: string }>(
    `/bon-achat/${id}/payments/${paymentId}`
  );
  return response.data;
};
