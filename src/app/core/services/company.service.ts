import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';

/**
 * CompanyService exposes directory-level facts about the ERP-owned company
 * collection. The admin navigation uses it to hide the Companies entry on
 * installations that never sync companies.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private http = inject(HttpClient);

  private hasCompaniesSubject = new BehaviorSubject<boolean>(false);
  private probed = false;

  /** True once the directory is known to hold at least one company. */
  hasCompanies$: Observable<boolean> = this.hasCompaniesSubject.asObservable();

  /** Probes the directory once per session; errors leave the flag false. */
  loadHasCompanies(): void {
    if (this.probed) return;
    this.probed = true;

    this.http.get<ApiResponse<unknown[]>>(`${environment.apiUrl}/company?page=1&count=1`).subscribe({
      next: response => {
        const total = response.pagination?.total ?? response.metadata?.total ?? (response.data?.length || 0);
        this.hasCompaniesSubject.next(total > 0);
      },
      error: () => {
        this.probed = false;
        this.hasCompaniesSubject.next(false);
      }
    });
  }
}
