import http from './http';

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name: string;
}

export interface UpdateCategoryDto {
  name?: string;
}

export const getCategories = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await http.get<Category[]>('/categories', { params });
  return response.data;
};

export const getCategory = async (id: string) => {
  const response = await http.get<Category>(`/categories/${id}`);
  return response.data;
};

export const createCategory = async (data: CreateCategoryDto) => {
  const response = await http.post<Category>('/categories', data);
  return response.data;
};

export const updateCategory = async (id: string, data: UpdateCategoryDto) => {
  const response = await http.put<Category>(`/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (id: string) => {
  await http.delete(`/categories/${id}`);
};

