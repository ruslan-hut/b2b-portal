export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Final price in dollars (converted from cents) - use priceFinal if available
  category: string;
  imageUrl?: string;
  inStock: boolean;
  sku: string;
  quantity?: number; // CRM inventory quantity (total stock) - may be deprecated on backend
  availableQuantity?: number; // Available to order (quantity - allocatedQuantity)
  allocatedQuantity?: number; // Quantity allocated to pending orders
  active?: boolean;  // Active status
  isNew?: boolean;   // New product badge
  isHotSale?: boolean; // Hot sale badge
  sortOrder?: number; // Display order priority
  // Calculated prices from frontend endpoint (optional - only present when using getFrontendProducts)
  basePrice?: number; // Base price in dollars
  priceWithVat?: number; // Price with VAT in dollars
  priceWithDiscount?: number; // Price with discount in dollars
  priceFinal?: number; // Final price (discount + VAT) in dollars
  vatRate?: number; // VAT rate percentage (0-100)
  discountPercent?: number; // Discount percentage (0-100)
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
  // and inventory per store
  price?: number; // Base price in cents (if provided)
  quantity?: number; // Deprecated global CRM quantity
  active: boolean;
  category?: string; // Category UID (not the name) - category names must be fetched separately via /category/description/{categoryUID}
  category_uid?: string; // Alternative field name that backend might use
  sku?: string;
  image?: string; // Product image URL
  is_new?: boolean; // New product badge
  is_hot_sale?: boolean; // Hot sale badge
  sort_order?: number; // Display order priority
}

// Frontend API format - products with calculated prices
export interface FrontendProduct {
  uid: string;
  name: string;
  description: string;
  base_price: number; // Original price in cents
  price_with_vat: number; // Price with VAT in cents
  price_with_discount: number; // Price with discount in cents
  price_final: number; // Final price (discount + VAT) in cents
  vat_rate: number; // VAT rate percentage (0-100)
  discount_percent: number; // Discount percentage (0-100)
  available_quantity: number; // Available stock
  category_uid: string;
  category_name?: string; // Category name/description for display
  image: string;
  is_new: boolean;
  is_hot_sale: boolean;
  sort_order: number;
  sku: string;
}
