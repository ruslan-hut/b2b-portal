import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { ClientBranch } from '../models/app-settings.model';

/**
 * Reads the ERP-owned client branch directory.
 *
 * There is deliberately no write method here: branches are created, edited and
 * deleted by the ERP sync. The portal only reads them, and links them to
 * addresses via the client_address upsert.
 */
@Injectable({ providedIn: 'root' })
export class ClientBranchService {
  private http = inject(HttpClient);

  /** Branches of a single client, ordered by name. */
  getForClient(clientUID: string): Observable<ClientBranch[]> {
    return this.getForClients([clientUID]).pipe(map(grouped => grouped[clientUID] || []));
  }

  /** Branches for several clients at once, grouped by parent client UID. */
  getForClients(clientUIDs: string[]): Observable<Record<string, ClientBranch[]>> {
    return this.http
      .post<ApiResponse<Record<string, ClientBranch[]>>>(
        `${environment.apiUrl}/client_branch/find/client`,
        { data: clientUIDs }
      )
      .pipe(map(response => response.data || {}));
  }
}
