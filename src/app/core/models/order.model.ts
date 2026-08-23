/**
 * Coarse, client-visible position in the order lifecycle. Every internal
 * pipeline stage is mapped onto one of these by an operator; an unmapped stage
 * yields '' and shows the client no position at all.
 */
export type ClientPhase = '' | 'placed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

/** The progress track. Cancelled ends an order rather than advancing it, so it is not a step. */
export const CLIENT_PHASE_FLOW: ClientPhase[] = ['placed', 'confirmed', 'processing', 'shipped', 'delivered'];

/** One position on the progress track, as returned by the order timeline endpoint. */
export interface ClientPhaseStep {
  phase: ClientPhase;
  reached: boolean;
  reached_at?: string;
}

/** The whole client-visible progress of an order. Carries no actor and no comment. */
export interface OrderClientTimeline {
  current: ClientPhase;
  steps: ClientPhaseStep[];
  cancelled: boolean;
  cancelled_at?: string;
}

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
  deliveryCost?: number; // Delivery cost amount
  // Coarse, client-visible position. The internal CRM stage name never reaches
  // the client — stages carry operator-authored names and internal notes.
  // Empty means the order sits in a stage nobody mapped to a client phase.
  clientPhase: ClientPhase;
  draft: boolean; // true = cart (not confirmed), false = confirmed order
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: ShippingAddress;
  // Individual address fields from backend
  countryCode?: string; // ISO country code (e.g., "UA", "PL")
  zipcode?: string; // Postal code
  city?: string; // City name
  addressText?: string; // Street address
  // Branch snapshot taken when the order was placed: the legal entity it is
  // invoiced to, with the tax identifiers that went on the document. Empty
  // branchUid means the account itself is the payer. Snapshot, not a live
  // lookup — a branch renamed later must not rewrite an issued invoice.
  branchUid?: string;
  branchName?: string;
  branchVatNumber?: string;
  branchBusinessRegistrationNumber?: string;
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
  lineNumber?: number; // 1-based line position, assigned at order confirm (0/undefined = draft/unset)
  availableQuantity?: number; // Available stock quantity from backend
  active?: boolean; // Product active flag (false = blocked from order placement)
}

// Item removed from the draft cart by server-side validation on login
export interface RemovedCartItem {
  productId: string;
  sku: string;
  productName: string;
  reason: 'not_found' | 'inactive' | 'no_price' | 'not_available';
  quantity: number;
}

// Another session of the same client account holds the cart editing lease, so
// saves from this session are refused until it lapses or the user takes the cart
// over. Surfaced by OrderService.cartLocked$.
export interface CartLockInfo {
  // User agent of the holding session, for naming it to the user. May be empty.
  holderUserAgent: string;
  // When the holder's lease lapses on its own, if the server reported it.
  expiresAt?: Date;
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
  // Branch (legal entity) this address is billed to; empty branch_uid means the
  // client itself. branch_active false = the order cannot be confirmed to it.
  branch_uid?: string;
  branch_name?: string;
  branch_active?: boolean;
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
  status?: string; // CRM stage name or legacy status
  draft?: boolean; // true = cart (not confirmed), false = confirmed order
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
  client_phase?: ClientPhase;
  draft?: boolean; // true = cart (not confirmed), false = confirmed order
  total: number;
  discount_percent?: number; // Client discount percentage (0-100)
  vat_rate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT
  total_vat?: number; // Total VAT amount
  original_total?: number; // Original total before discount
  discount_amount?: number; // Total discount amount saved
  delivery_cost?: number; // Delivery cost in cents
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
  boxes?: BackendOrderBox[]; // Physical packaging from ERP (present after packing)
}

// BackendOrderBox represents a packaging box produced by the ERP after packing the order.
// Carries only physical attributes (dimensions in cm, weight in kg); no monetary data.
export interface BackendOrderBox {
  order_uid: string;
  box_number: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_kg: number;
  last_update?: string;
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
  line_number?: number; // 1-based line position (0 = draft/unset)
  last_update?: string;
}
