export interface Store {
  uid: string;
  name: string;
  active?: boolean;
  default_vat_rate?: number; // Default VAT rate for clients without VAT number (0-100)
  country_code?: string;
  show_quantity?: boolean;
  require_business_registration?: boolean; // Require clients to have a business registration number before confirming an order
  // Restrict the catalog and order confirmation to products the ERP marked available
  // for the client's delivery country (product country availability / certification).
  use_certification_filter?: boolean;
  order_prefix?: string; // Store part of composed order numbers (latin letters and digits, max 10); numeric store ID is used when empty
  last_update?: string;
}
