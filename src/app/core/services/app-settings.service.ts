import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppSettings } from '../models/app-settings.model';
import { User, Client, AuthMeResponse } from '../models/user.model';

interface ApiResponse<T> {
  status: string;
  success?: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  private readonly SETTINGS_KEY = 'APP_SETTINGS';
  private readonly apiUrl = environment.apiUrl;

  private settingsSubject: BehaviorSubject<AppSettings | null>;
  public settings$: Observable<AppSettings | null>;

  constructor(private http: HttpClient) {
    // Load settings from localStorage on init
    const stored = this.getStoredSettings();
    this.settingsSubject = new BehaviorSubject<AppSettings | null>(stored);
    this.settings$ = this.settingsSubject.asObservable();
  }

  /**
   * Get current settings value synchronously
   */
  public getSettingsValue(): AppSettings | null {
    return this.settingsSubject.value;
  }

  /**
   * Load settings from /auth/me endpoint
   */
  loadSettings(): Observable<AppSettings> {
    return this.http.get<AuthMeResponse>(`${this.apiUrl}/auth/me`).pipe(
      map(response => {
        // Support both 'status: success' and 'success: true' formats
        const isSuccess = response.status === 'success' || (response as any).success === true;

        if (!isSuccess) {
          throw new Error('Failed to load app settings');
        }

        // Check if response includes app_settings (new format)
        const responseData = response.data as any;
        let appSettings: AppSettings | null = null;

        if (responseData.app_settings) {
          // New format with AppSettings object
          appSettings = responseData.app_settings as AppSettings;
        } else {
          // Legacy format - construct AppSettings from response
          appSettings = this.constructSettingsFromLegacyResponse(responseData);
        }

        if (!appSettings) {
          throw new Error('Failed to parse app settings from response');
        }

        // Store settings
        this.storeSettings(appSettings);
        this.settingsSubject.next(appSettings);

        return appSettings;
      }),
      catchError(error => {
        console.error('Failed to load app settings:', error);
        this.clearSettings();
        return throwError(() => error);
      })
    );
  }

  /**
   * Construct AppSettings from legacy /auth/me response format
   * This provides backward compatibility during migration
   */
  private constructSettingsFromLegacyResponse(responseData: any): AppSettings | null {
    const entityType = responseData.entity_type;
    const entity = entityType === 'user' ? responseData.user : responseData.client;

    if (!entity) {
      return null;
    }

    // For legacy format, we don't have currency/store/price_type
    // Return minimal AppSettings - components will need to fetch separately
    return {
      entity: entity,
      entity_type: entityType,
      effective_vat_rate: 0, // Will need to be calculated separately
      token_info: responseData.token_info
    };
  }

  /**
   * Clear settings (on logout)
   */
  clearSettings(): void {
    localStorage.removeItem(this.SETTINGS_KEY);
    this.settingsSubject.next(null);
  }

  /**
   * Store settings in localStorage
   */
  private storeSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to store app settings:', error);
    }
  }

  /**
   * Get stored settings from localStorage
   */
  private getStoredSettings(): AppSettings | null {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stored app settings:', error);
    }
    return null;
  }

  /**
   * Get current entity (User or Client)
   */
  getCurrentEntity(): User | Client | null {
    const settings = this.getSettingsValue();
    return settings ? settings.entity : null;
  }

  /**
   * Get current entity type
   */
  getCurrentEntityType(): 'user' | 'client' | null {
    const settings = this.getSettingsValue();
    return settings ? settings.entity_type : null;
  }

  /**
   * Get currency object
   */
  getCurrency(): any | null {
    const settings = this.getSettingsValue();
    return settings?.currency || null;
  }

  /**
   * Get store object
   */
  getStore(): any | null {
    const settings = this.getSettingsValue();
    return settings?.store || null;
  }

  /**
   * Get price type object
   */
  getPriceType(): any | null {
    const settings = this.getSettingsValue();
    return settings?.price_type || null;
  }

  /**
   * Get effective VAT rate
   */
  getEffectiveVatRate(): number {
    const settings = this.getSettingsValue();
    return settings?.effective_vat_rate || 0;
  }

  /**
   * Update settings (e.g., after address changes)
   * Called when backend returns updated AppSettings
   */
  updateSettings(settings: AppSettings): void {
    this.storeSettings(settings);
    this.settingsSubject.next(settings);
  }
}

