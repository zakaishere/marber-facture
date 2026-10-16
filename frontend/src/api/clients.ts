import http from './http';

export interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  ice?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  name: string;
  phone?: string;
  address?: string;
  ice?: string;
}

export interface UpdateClientDto {
  name?: string;
  phone?: string;
  address?: string;
  ice?: string;
}

export const getClients = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await http.get<Client[]>('/clients', { params });
  return response.data;
};

export const getClient = async (id: string) => {
  const response = await http.get<Client>(`/clients/${id}`);
  return response.data;
};

export const createClient = async (data: CreateClientDto) => {
  const response = await http.post<Client>('/clients', data);
  return response.data;
};

export const updateClient = async (id: string, data: UpdateClientDto) => {
  const response = await http.put<Client>(`/clients/${id}`, data);
  return response.data;
};

export const deleteClient = async (id: string) => {
  await http.delete(`/clients/${id}`);
};

