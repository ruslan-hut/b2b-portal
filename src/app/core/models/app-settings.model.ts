import { User, Client } from './user.model';
import { Currency } from './currency.model';
import { Store } from './store.model';
import { PriceType } from './price-type.model';

// Client address (for AppSettings)
export interface ClientAddress {
  uid?: string;
  client_uid?: string;
  country_code: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  is_default?: boolean;
  last_update?: string;
}

export interface AppSettings {
  entity: User | Client;
  entity_type: 'user' | 'client';
  currency?: Currency;
  store?: Store;
  price_type?: PriceType;
  effective_vat_rate: number; // Calculated VAT rate: client.vat_rate if vat_number exists, else store.default_vat_rate
  addresses?: ClientAddress[]; // Client addresses (only for clients)
  token_info?: {
    token_uid: string;
    issued_at: string;
    expires_at: string;
  };
}

