export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  inStock: boolean;
  sku: string;
  quantity?: number; // CRM inventory quantity (total stock) - may be deprecated on backend
  availableQuantity?: number; // Available to order (quantity - allocatedQuantity)
  allocatedQuantity?: number; // Quantity allocated to pending orders
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
  // price and quantity are optional because the backend now stores prices per price-type
  // and inventory per store. Older API versions may still include them.
  price?: number; // In cents (deprecated)
  quantity?: number; // Deprecated global CRM quantity
  active: boolean;
  category?: string; // Category UID (not the name) - category names must be fetched separately via /category/description/{categoryUID}
  category_uid?: string; // Alternative field name that backend might use
  sku?: string;
  image?: string; // Product image URL
}
