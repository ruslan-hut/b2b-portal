import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AdminUser {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  store_uid?: string;
  price_type_uid?: string;
  last_login?: string;
  last_update: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: any;
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
   * Get formatted manager options for dropdowns
   * Returns managers and admins as select options
   */
  getManagerOptions(): Observable<SelectOption[]> {
    return this.getUsers(['manager', 'admin'])
      .pipe(
        map(users => users.map(user => {
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
