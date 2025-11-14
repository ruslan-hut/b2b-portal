export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  inStock: boolean;
  sku: string;
  quantity?: number; // Stock quantity
  active?: boolean;  // Active status
}

export interface ProductCategory {
  id: string;
  name: string;
}

// Backend API format
export interface BackendProduct {
  uid: string;
  name?: string;
  price: number; // In cents
  quantity: number;
  active: boolean;
  category?: string;
  sku?: string;
}

