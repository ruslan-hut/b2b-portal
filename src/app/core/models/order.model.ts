export interface Order {
  id: string;
  orderNumber: string;
  number?: string; // Optional order number from backend
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: ShippingAddress;
  comment?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
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
  user_uid: string;
  status?: 'draft' | 'new' | 'processing' | 'confirmed'; // Frontend can only use 'draft' or 'new'
  total: number;
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
  user_uid: string;
  status: string;
  total: number;
  shipping_address: string;
  billing_address?: string;
  comment?: string;
  created_at: string;
  updated_at: string;
  // Some backend API versions use `last_update` instead of `updated_at`.
  last_update?: string;
}
