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
  category?: string; // Category UID (not the name) - category names must be fetched separately via /category/description/{categoryUID}
  category_uid?: string; // Alternative field name that backend might use
  sku?: string;
  image?: string; // Product image URL
}

