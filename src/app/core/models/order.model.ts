export interface Order {
  id: string;
  orderNumber: string;
  number?: string; // Optional order number from backend
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  discountPercent?: number; // Client discount percentage (0-100)
  vatRate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT
  totalVat?: number; // Total VAT amount
  originalTotal?: number; // Original total before discount (NET)
  originalTotalWithVat?: number; // Original total before discount (GROSS with VAT) - matches product card display
  discountAmount?: number; // Total discount amount saved (NET)
  discountAmountWithVat?: number; // Total discount amount saved (GROSS with VAT) - for consistent display
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: ShippingAddress;
  // Individual address fields from backend
  countryCode?: string; // ISO country code (e.g., "UA", "PL")
  zipcode?: string; // Postal code
  city?: string; // City name
  addressText?: string; // Street address
  comment?: string;
  // Address fields from cart
  address?: CartAddress;
  vatRateChanged?: boolean; // True if VAT rate changed from previous value
}

export interface OrderItem {
  sku?: string; // Product SKU
  productId: string;
  productName: string;
  quantity: number;
  price: number; // Base price without VAT or discount
  priceWithVat?: number; // Base price with VAT (per unit)
  discount?: number; // Discount percentage (0-100)
  priceDiscount?: number; // Price after discount (without VAT)
  priceAfterDiscountWithVat?: number; // Price after discount with VAT (per unit)
  tax?: number; // VAT amount for this item
  subtotal: number; // Total with VAT (quantity × priceDiscount + tax)
  isNew?: boolean;   // New product badge
  barcode?: string;
  sortOrder?: number; // Display order priority
  availableQuantity?: number; // Available stock quantity from backend
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Cart address from backend (used in cart responses)
export interface CartAddress {
  uid: string;
  country_code: string;
  country_name: string;
  zipcode: string;
  city: string;
  address_text: string;
  shipping_address: string; // Formatted address for display
  is_default: boolean;
}

export enum OrderStatus {
  DRAFT = 'draft',           // Saved cart, no validation, no allocation
  NEW = 'new',               // User confirmed, stock validated, allocation created
  PROCESSING = 'processing', // CRM fulfilling order (cannot modify from frontend)
  CONFIRMED = 'confirmed',   // CRM completed order, allocation deleted
  CANCELLED = 'cancelled'    // Order cancelled
}

export interface CreateOrderRequest {
  items: {
    productId: string;
    quantity: number;
  }[];
  shippingAddress: ShippingAddress;
  comment?: string;
}

// Backend API format
export interface BackendOrderRequest {
  uid?: string;
  // Backend migrated from `user_uid` to `client_uid` — prefer `client_uid`
  client_uid?: string;
  // Keep user_uid optional for backward compatibility
  user_uid?: string;
  status?: 'draft' | 'new' | 'processing' | 'confirmed'; // Frontend can only use 'draft' or 'new'
  total: number;
  discount_percent?: number; // Client discount percentage (0-100)
  vat_rate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT (in cents)
  total_vat?: number; // Total VAT amount (in cents)
  shipping_address: string;
  billing_address?: string;
  comment?: string;
  items: {
    order_uid?: string;
    product_uid: string;
    quantity: number;
    price: number;
    discount?: number;
    total: number;
  }[];
}

export interface BackendOrderResponse {
  uid: string;
  number?: string; // Optional order number from backend
  // New API uses client_uid; keep user_uid for compatibility
  client_uid?: string;
  user_uid?: string;
  status: string;
  total: number;
  discount_percent?: number; // Client discount percentage (0-100)
  vat_rate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT
  total_vat?: number; // Total VAT amount
  original_total?: number; // Original total before discount
  discount_amount?: number; // Total discount amount saved
  shipping_address: string;
  billing_address?: string;
  // Individual address fields from backend
  country_code?: string; // ISO country code (e.g., "UA", "PL")
  zipcode?: string; // Postal code
  city?: string; // City name
  address_text?: string; // Street address
  comment?: string;
  created_at: string;
  updated_at: string;
  // Some backend API versions use `last_update` instead of `updated_at`.
  last_update?: string;
  items?: BackendOrderItem[]; // Order items
}

export interface BackendOrderItem {
  order_uid: string;
  product_uid: string;
  product_sku?: string; // Product SKU
  product_name?: string; // Product name
  quantity: number;
  price: number; // Base price without VAT or discount (cents)
  base_price?: number; // Alias for price (cents)
  price_with_vat?: number; // Base price with VAT (cents)
  discount?: number; // Discount percentage (0-100)
  price_discount?: number; // Price after discount without VAT (cents)
  price_after_discount_with_vat?: number; // Price after discount with VAT (cents)
  tax?: number; // VAT amount for this item
  total: number; // Total with VAT (cents)
  subtotal?: number; // Alias for total (cents)
  last_update?: string;
}
