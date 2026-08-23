import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';

export interface AdminUser {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  /** Login gate. False means blocked by an admin or dropped from the ERP roster. */
  active?: boolean;
  store_uid?: string;
  price_type_uid?: string;
  receive_email_notifications?: boolean;
  all_orders?: boolean;
  /** Binotel SIP extension, mapped by hand on the telephony settings page. */
  binotel_internal_number?: string;
  last_login?: string;
  last_update: string;
}

export interface NotificationPreferences {
  receive_email_notifications: boolean;
  all_orders: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get all users with optional role filtering
   * @param roles Optional array of roles to filter by (e.g., ['admin', 'manager'])
   * @param offset Pagination offset
   * @param limit Pagination limit
   */
  getUsers(roles?: string[], offset = 0, limit = 1000): Observable<AdminUser[]> {
    let params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<AdminUser[]>>(`${this.apiUrl}/admin/user`, { params })
      .pipe(
        map(response => {
          const users = response.data || [];

          // Filter by roles if provided
          if (roles && roles.length > 0) {
            return users.filter(user => roles.includes(user.role));
          }

          return users;
        })
      );
  }

  /**
   * Get staff directory (admin + manager users)
   * Accessible to both admin and manager roles
   */
  getStaff(): Observable<AdminUser[]> {
    return this.http.get<ApiResponse<AdminUser[]>>(`${this.apiUrl}/admin/staff`)
      .pipe(map(response => response.data || []));
  }

  /**
   * Update the authenticated staff user's own notification preferences.
   */
  updateMyPreferences(prefs: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.patch<ApiResponse<NotificationPreferences>>(
      `${this.apiUrl}/auth/me/preferences`,
      prefs
    ).pipe(map(response => response.data ?? prefs));
  }

  /**
   * Get formatted manager options for dropdowns
   * Returns managers and admins as select options
   *
   * Blocked accounts are dropped: they cannot log in, so assigning work to one
   * silently parks it. getStaff() itself stays unfiltered so screens that only
   * resolve a stored UID to a name still find a blocked manager.
   */
  getManagerOptions(): Observable<SelectOption[]> {
    return this.getStaff()
      .pipe(
        map(users => users.filter(user => user.active !== false).map(user => {
          // Use first name + last name if available, otherwise use username
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
          const displayName = fullName || user.username;

          return {
            value: user.uid,
            label: displayName
          };
        }))
      );
  }
}
