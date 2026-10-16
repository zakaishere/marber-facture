import http from './http';

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierDto {
  name: string;
  phone?: string;
  address?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  phone?: string;
  address?: string;
}

export const getSuppliers = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await http.get<Supplier[]>('/suppliers', { params });
  return response.data;
};

export const getSupplier = async (id: string) => {
  const response = await http.get<Supplier>(`/suppliers/${id}`);
  return response.data;
};

export const createSupplier = async (data: CreateSupplierDto) => {
  const response = await http.post<Supplier>('/suppliers', data);
  return response.data;
};

export const updateSupplier = async (id: string, data: UpdateSupplierDto) => {
  const response = await http.put<Supplier>(`/suppliers/${id}`, data);
  return response.data;
};

export const deleteSupplier = async (id: string) => {
  await http.delete(`/suppliers/${id}`);
};

