import http from './http';

export interface StockDimension {
  lengthCm: number;
  widthCm: number;
  pieces: number;
  surfaceM2: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  quantity: number;
  minStock: number;
  dimensionCount?: number;
  stockPieces?: number;
  stockDimensions?: StockDimension[];
  purchaseStockValue?: string;
  saleStockValue?: string;
  purchasedSurface: number;
  soldSurface: number;
  sold30Days: number;
  alertThreshold: number;
  lastPurchasePrice: number;
  salePrice: number;
  categoryId: string;
  tvaRate: number;
  category?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductSummary {
  totalProducts: number;
  totalQuantity: number;
  lowStockCount: number;
  negativeStockCount: number;
}

export interface CreateProductDto {
  code?: string; // Optional - will be auto-generated if not provided
  name: string;
  categoryId: string;
  minStock?: number;
  lastPurchasePrice?: number;
  salePrice?: number;
  quantity?: number;
  tvaPercent?: number;
}

export interface UpdateProductDto {
  code?: string;
  name?: string;
  categoryId?: string;
  minStock?: number;
  lastPurchasePrice?: number;
  salePrice?: number;
  quantity?: number;
  tvaPercent?: number;
}

export interface StockAdjustmentDto {
  delta: number;
  reason: string;
}

export const getProducts = async (params?: {
  search?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
  lowStock?: boolean;
  stockDetails?: boolean;
}) => {
  const response = await http.get<Product[]>('/products', { params });
  return response.data;
};

export const getProduct = async (id: string) => {
  const response = await http.get<Product>(`/products/${id}`);
  return response.data;
};

export const getProductSummary = async () => {
  const response = await http.get<ProductSummary>('/products/summary');
  return response.data;
};

export const createProduct = async (data: CreateProductDto) => {
  const response = await http.post<Product>('/products', data);
  return response.data;
};

export const updateProduct = async (id: string, data: UpdateProductDto) => {
  const response = await http.put<Product>(`/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id: string) => {
  await http.delete(`/products/${id}`);
};

export const adjustProductStock = async (id: string, data: StockAdjustmentDto) => {
  const response = await http.post(`/products/${id}/adjustments`, data);
  return response.data;
};
