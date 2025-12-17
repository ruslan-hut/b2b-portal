export interface Store {
  uid: string;
  name: string;
  active?: boolean;
  default_vat_rate?: number; // Default VAT rate for clients without VAT number (0-100)
  last_update?: string;
}
