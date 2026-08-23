export type OrderSplitMode = 'parts' | 'limit';

export interface OrderSplitRequest {
  order_uid: string;
  mode: OrderSplitMode;
  /** Number of equal parts. Sent for mode 'parts'. */
  parts?: number;
  /** Maximum gross amount of one part, in cents. Sent for mode 'limit'. */
  limit?: number;
  tolerance_percent?: number;
  /** Per-part company / payer assignments. Parts left out inherit the order's. */
  assignments?: OrderSplitPartAssignment[];
}

/**
 * Points one part at a selling company and/or a billed party.
 *
 * Both fields are optional and distinguish three states, matching the backend:
 * absent means "inherit from the source order", an empty string means "clear it"
 * (for a branch: bill the parent client directly), and a UID means that entity.
 */
export interface OrderSplitPartAssignment {
  /** 1-based part number, matching OrderSplitPart.index. */
  index: number;
  company_uid?: string;
  branch_uid?: string;
}

export interface OrderSplitPartItem {
  product_uid: string;
  sku?: string;
  name?: string;
  quantity: number;
  /** Gross amount this line contributes to the part, in cents. */
  total: number;
  /** True when the source line was cut across parts. */
  divided?: boolean;
}

export interface OrderSplitPart {
  index: number;
  total: number;
  items: OrderSplitPartItem[];
  /** Present only once the part has been created. */
  order_uid?: string;
  number?: string;

  /** Who sells and who is billed, after any assignment. Always populated. */
  company_uid?: string;
  company_name?: string;
  /** Empty when the part is billed to the parent client directly. */
  branch_uid?: string;
  payer_name?: string;
  /** Always the source order's rate — an assignment that would move it is refused. */
  vat_rate: number;
  /** Warning slugs about the part's invoicing identity; see splitWarningKey(). */
  warnings?: string[];
}

/** One selectable selling legal entity. */
export interface OrderSplitCompanyOption {
  uid: string;
  name: string;
}

/**
 * One selectable billed party: a branch, or the client itself when uid is ''.
 *
 * vat_neutral is what decides selectability. A split may not move money, so only
 * a party producing the order's existing VAT rate can be chosen; the others are
 * still listed, with the rate they would produce, so the operator can see why.
 */
export interface OrderSplitBranchOption {
  uid: string;
  is_client?: boolean;
  name: string;
  vat_number?: string;
  result_vat_rate: number;
  vat_neutral: boolean;
  warnings?: string[];
  active: boolean;
}

export interface OrderSplitOptions {
  order_uid: string;
  current_vat_rate: number;
  current_company_uid?: string;
  current_branch_uid?: string;
  client_name?: string;
  companies: OrderSplitCompanyOption[];
  branches: OrderSplitBranchOption[];
}

export interface OrderSplitPreview {
  order_uid: string;
  number?: string;
  currency_code?: string;
  total: number;
  target_amount: number;
  tolerance_percent: number;
  mode: OrderSplitMode;
  parts: OrderSplitPart[];
  divided_products?: string[];
  within_tolerance: boolean;
}

export interface CanSplitOrderResponse {
  can_split: boolean;
  /** English sentence, for logs and as a last-resort tooltip. */
  reason?: string;
  /** Stable slug the UI translates — see `admin.orders.splitBlocked.*`. */
  reason_code?: string;
  /** Set only with reason_code 'stage_forbids'. */
  stage_name?: string;
}
