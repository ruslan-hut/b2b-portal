import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AdminClientAddress {
  uid: string;
  client_uid: string;
  country_code: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  is_default: boolean;
  last_update?: string;
}

export interface AdminClientAddressUpsert {
  uid?: string;
  client_uid: string;
  country_code: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  is_default: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get addresses for multiple clients
   * @param clientUids Array of client UIDs
   * @returns Map of client UID to their addresses
   */
  getAddressesByClients(clientUids: string[]): Observable<{[clientUid: string]: AdminClientAddress[]}> {
    return this.http.post<ApiResponse<{[clientUid: string]: AdminClientAddress[]}>>(
      `${this.apiUrl}/client_address/find/client`,
      { data: clientUids }
    ).pipe(
      map(response => {
        // Response is already a map: { "client-uid": [addresses...] }
        return response.data || {};
      })
    );
  }

  /**
   * Upsert (create or update) addresses
   * @param addresses Array of addresses to upsert
   */
  upsertAddresses(addresses: AdminClientAddressUpsert[]): Observable<void> {
    return this.http.post<ApiResponse<string[]>>(
      `${this.apiUrl}/client_address`,
      { data: addresses }
    ).pipe(
      map(() => void 0)
    );
  }

  /**
   * Delete addresses by UIDs
   * @param addressUids Array of address UIDs to delete
   */
  deleteAddresses(addressUids: string[]): Observable<void> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/client_address/delete`,
      { data: addressUids }
    ).pipe(
      map(() => void 0)
    );
  }
}
