import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { ClientCertificationCountry } from '../models/client-certification-country.model';

/**
 * Reads the ERP-owned list of countries each client sells into.
 *
 * There is deliberately no write method here: the ERP owns the list, and it is
 * what the certification gate is evaluated against — not the delivery address,
 * because a client may take delivery in one country and resell into others. The
 * admin zone only shows it.
 */
@Injectable({ providedIn: 'root' })
export class ClientCertificationCountryService {
  private readonly http = inject(HttpClient);

  /** Country codes of a single client, in the order the API returned them. */
  getForClient(clientUID: string): Observable<string[]> {
    return this.getForClients([clientUID]).pipe(map(grouped => grouped[clientUID] || []));
  }

  /** Country codes for several clients at once, grouped by client UID. */
  getForClients(clientUIDs: string[]): Observable<Record<string, string[]>> {
    return this.http
      .post<ApiResponse<ClientCertificationCountry[]>>(
        `${environment.apiUrl}/admin/client_certification_countries/batch`,
        { data: clientUIDs }
      )
      .pipe(
        map(response => {
          const grouped: Record<string, string[]> = {};
          for (const row of response.data || []) {
            if (!row.client_uid || !row.country_code) {
              continue;
            }
            (grouped[row.client_uid] ??= []).push(row.country_code);
          }
          return grouped;
        })
      );
  }
}
