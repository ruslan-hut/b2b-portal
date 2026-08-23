import { User, Client } from './user.model';
import { Currency } from './currency.model';
import { Store } from './store.model';
import { PriceType } from './price-type.model';

// Client address (for AppSettings)
export interface ClientAddress {
  uid?: string;
  client_uid?: string;
  branch_uid?: string;   // branch this address belongs to; empty = the client directly
  country_code: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  is_default?: boolean;
  is_official?: boolean; // marks the client's official/invoicing address
  last_update?: string;
}

/**
 * A branch (filial, point of sale) of a client. The parent client holds every
 * commercial parameter — discount, balance, manager, price type, store, PIN —
 * while a branch holds only its own legal identity and is billed in place of
 * the parent when an order goes to one of its addresses.
 *
 * The ERP owns this data: branches are read-only in the portal.
 */
export interface ClientBranch {
  uid: string;
  client_uid: string;
  name: string;
  vat_number?: string;
  vat_rate?: number;
  business_registration_number?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  active: boolean;
  last_update?: string;
}

// Discount information for scale-based discounts
export interface DiscountInfo {
  current_balance: number;           // Current balance in cents
  current_discount: number;          // Current discount percentage (excludes additional_discount)
  additional_discount?: number;      // Bonus discount in percentage points, added after any product discount limit
  next_threshold?: number;           // Next tier threshold in cents
  amount_to_next?: number;           // Amount to reach next tier
  next_discount?: number;            // Discount percentage at next tier
  has_next_tier: boolean;            // Whether there's a higher tier
  is_fixed_discount: boolean;        // Whether using fixed discount mode
  is_cumulative_discount: boolean;   // Whether cumulative discount mode is enabled
}

// What the authenticated entity may do in the client area. Staff users get a
// read-only catalog preview: browsing allowed, cart and ordering disabled.
export interface Capabilities {
  catalog_preview: boolean;       // true for staff: catalog is a read-only preview
  cart_enabled: boolean;          // false: hide/disable all cart actions
  order_confirm_enabled: boolean; // false: hide/disable order confirmation
  api_access?: boolean;           // true: the client may manage its own Client API keys (profile page)
}

export interface AppSettings {
  entity: User | Client;
  entity_type: 'user' | 'client';
  currency?: Currency;
  store?: Store;
  price_type?: PriceType;
  // Backend-resolved VAT rate for catalog/cart display, based on the client's default
  // delivery address: the store default for a domestic destination, the client's own
  // rate cross-border with a VAT number. Display it as given; do not re-derive it.
  effective_vat_rate: number;
  addresses?: ClientAddress[]; // Client addresses (only for clients)
  // Branches of the client (only for clients). Read-only — the ERP owns them.
  // Sent so the profile can name the branch an address belongs to, since an
  // address carries only its branch_uid.
  branches?: ClientBranch[];
  discount_info?: DiscountInfo; // Discount tier info (only for clients)
  token_info?: {
    token_uid: string;
    issued_at: string;
    expires_at: string;
  };
  capabilities?: Capabilities; // Action flags from backend; absent in stale/legacy responses
}

