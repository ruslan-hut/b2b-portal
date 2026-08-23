/**
 * One country a client sells into, as pushed by the ERP.
 *
 * The catalog gate is evaluated against these countries rather than the client's
 * delivery address: goods delivered to one country are often resold into
 * another, and what must be certified is the final destination.
 */
export interface ClientCertificationCountry {
  client_uid: string;
  country_code: string;
  last_update?: string;
}
