import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppSettings, ClientAddress } from '../models/app-settings.model';
import { AppSettingsService } from './app-settings.service';

// API Response interface matching backend response structure
interface ApiResponse<T> {
  success: boolean;
  data: T;
  status_message?: string;
}

// Client profile update request (only editable fields)
export interface ClientProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  vat_number?: string;
  language?: string;
}

// Country entity
export interface Country {
  country_code: string;
  name: string;
  vat_rate?: number;
}

// Re-export ClientAddress for backward compatibility
export { ClientAddress } from '../models/app-settings.model';

// Address upsert request
export interface AddressUpsertRequest {
  uid?: string;
  country_code: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  is_default?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private appSettingsService: AppSettingsService
  ) {}

  /**
   * Update the current client's profile
   * Only allowed fields: name, email, phone, vat_number
   */
  updateMyProfile(data: ClientProfileUpdate): Observable<void> {
    return this.http.put<ApiResponse<null>>(`${this.apiUrl}/frontend/profile`, data).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to update profile');
        }
      }),
      catchError(error => {
        console.error('Update profile error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all addresses for the current client
   * Note: Addresses are now included in AppSettings, this is kept for backward compatibility
   */
  getMyAddresses(): Observable<ClientAddress[]> {
    return this.http.get<ApiResponse<ClientAddress[]>>(`${this.apiUrl}/frontend/profile/addresses`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to get addresses');
        }
        return response.data || [];
      }),
      catchError(error => {
        console.error('Get addresses error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add or update an address for the current client
   * Backend now returns updated AppSettings with all addresses
   */
  upsertAddress(address: AddressUpsertRequest): Observable<AppSettings> {
    return this.http.post<ApiResponse<AppSettings>>(`${this.apiUrl}/frontend/profile/addresses`, address).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to save address');
        }
        return response.data;
      }),
      tap(appSettings => {
        // Update AppSettings with new addresses
        if (appSettings) {
          this.appSettingsService.updateSettings(appSettings);
        }
      }),
      catchError(error => {
        console.error('Upsert address error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete an address
   * Backend now returns updated AppSettings with remaining addresses
   */
  deleteAddress(uid: string): Observable<AppSettings> {
    return this.http.delete<ApiResponse<AppSettings>>(`${this.apiUrl}/frontend/profile/addresses/${uid}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to delete address');
        }
        return response.data;
      }),
      tap(appSettings => {
        // Update AppSettings with remaining addresses
        if (appSettings) {
          this.appSettingsService.updateSettings(appSettings);
        }
      }),
      catchError(error => {
        console.error('Delete address error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Set an address as the default
   * Backend now returns updated AppSettings with updated default flag
   */
  setDefaultAddress(uid: string): Observable<AppSettings> {
    return this.http.put<ApiResponse<AppSettings>>(`${this.apiUrl}/frontend/profile/addresses/${uid}/default`, {}).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to set default address');
        }
        return response.data;
      }),
      tap(appSettings => {
        // Update AppSettings with updated default address
        if (appSettings) {
          this.appSettingsService.updateSettings(appSettings);
        }
      }),
      catchError(error => {
        console.error('Set default address error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get available languages for product descriptions
   */
  getAvailableLanguages(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/frontend/languages`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to get languages');
        }
        return response.data || ['en'];
      }),
      catchError(error => {
        console.error('Get languages error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all countries from the database
   */
  getCountries(): Observable<Country[]> {
    // Request all countries (up to 500) for autocomplete
    const body = { page: 1, count: 500 };
    return this.http.post<ApiResponse<Country[]>>(`${this.apiUrl}/frontend/countries`, body).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.status_message || 'Failed to get countries');
        }
        return response.data || [];
      }),
      catchError(error => {
        console.error('Get countries error:', error);
        return throwError(() => error);
      })
    );
  }
}
