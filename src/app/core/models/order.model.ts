export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: ShippingAddress;
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
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export interface CreateOrderRequest {
  items: {
    productId: string;
    quantity: number;
  }[];
  shippingAddress: ShippingAddress;
}

// Backend API format
export interface BackendOrderRequest {
  uid?: string;
  user_uid: string;
  status?: 'new' | 'processing' | 'confirmed';
  total: number;
  shipping_address: string;
  billing_address?: string;
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
  user_uid: string;
  status: string;
  total: number;
  shipping_address: string;
  billing_address?: string;
  created_at: string;
  updated_at: string;
}

