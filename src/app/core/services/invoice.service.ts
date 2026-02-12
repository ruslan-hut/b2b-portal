import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface InvoiceSettings {
  id: number;
  enabled: boolean;
  created_at?: string;
  last_update?: string;
}

export interface InvoiceType {
  uid: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  active: boolean;
  store_uid?: string | null;
  created_at?: string;
  last_update?: string;
}

export interface Invoice {
  uid: string;
  order_uid: string;
  type_uid: string;
  response_type: 'link' | 'file';
  response_data?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  error?: string;
  status_code: number;
  requested_by?: string;
  created_at: string;
}

export interface InvoiceTypesResponse {
  success: boolean;
  data: InvoiceType[];
  pagination?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface InvoicesResponse {
  success: boolean;
  data: Invoice[];
  pagination?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface InvoiceTestResponse {
  success: boolean;
  status_code: number;
  response_type?: string;
  content_type?: string;
  content_length?: number;
  error?: string;
}

export interface InvoiceRequestResponse {
  success: boolean;
  data?: Invoice;
  error?: string;
}

export interface InvoiceTypeUpsertRequest {
  uid?: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  active: boolean;
  store_uid?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ========== Settings (Singleton) ==========

  /**
   * Get invoice settings
   */
  getSettings(): Observable<InvoiceSettings> {
    return this.http.get<any>(`${this.apiUrl}/admin/invoice/settings`).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * Update invoice settings
   */
  updateSettings(enabled: boolean): Observable<InvoiceSettings> {
    return this.http.put<any>(`${this.apiUrl}/admin/invoice/settings`, { data: { enabled } }).pipe(
      map((response: any) => response.data || response)
    );
  }

  // ========== Invoice Types ==========

  /**
   * List invoice types with pagination
   */
  listTypes(page: number = 1, count: number = 50): Observable<InvoiceTypesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());

    return this.http.get<InvoiceTypesResponse>(`${this.apiUrl}/admin/invoice/types`, { params });
  }

  /**
   * Get invoice types by UIDs
   */
  getTypesByUIDs(uids: string[]): Observable<InvoiceType[]> {
    return this.http.post<any>(`${this.apiUrl}/admin/invoice/types/batch`, { data: uids }).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * Create or update invoice types
   */
  upsertTypes(types: InvoiceTypeUpsertRequest[]): Observable<string[]> {
    return this.http.post<any>(`${this.apiUrl}/admin/invoice/types`, { data: types }).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * Delete invoice types by UIDs
   */
  deleteTypes(uids: string[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/invoice/types/delete`, { data: uids });
  }

  /**
   * Update invoice type active status
   */
  updateTypeActive(uid: string, active: boolean): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/invoice/types/active`, { data: { uid, active } });
  }

  /**
   * Test invoice type configuration
   */
  testType(url: string, method: 'GET' | 'POST', headers?: Record<string, string>): Observable<InvoiceTestResponse> {
    return this.http.post<any>(`${this.apiUrl}/admin/invoice/types/test`, {
      data: {
        url,
        method,
        headers: headers || {}
      }
    }).pipe(
      map((response: any) => response.data || response)
    );
  }

  // ========== Invoice History ==========

  /**
   * List invoices with pagination
   */
  listInvoices(page: number = 1, count: number = 50, orderUid?: string): Observable<InvoicesResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());

    if (orderUid) {
      params = params.set('order_uid', orderUid);
    }

    return this.http.get<InvoicesResponse>(`${this.apiUrl}/admin/invoice/history`, { params });
  }

  /**
   * Delete invoice records by UIDs
   */
  deleteInvoices(uids: string[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/invoice/history/delete`, {
      data: uids
    });
  }

  /**
   * Cleanup old invoice records
   */
  cleanupInvoices(retentionDays?: number): Observable<any> {
    let params = new HttpParams();
    if (retentionDays) {
      params = params.set('retention_days', retentionDays.toString());
    }
    return this.http.delete<any>(`${this.apiUrl}/admin/invoice/history/cleanup`, { params });
  }

  // ========== Order Invoice Operations ==========

  /**
   * Request invoice for an order
   */
  requestInvoice(orderUid: string, typeUid: string): Observable<InvoiceRequestResponse> {
    return this.http.post<any>(`${this.apiUrl}/admin/orders/invoice/request`, {
      data: {
        order_uid: orderUid,
        type_uid: typeUid
      }
    });
  }

  /**
   * Get available invoice types for an order
   */
  getTypesForOrder(orderUid: string): Observable<InvoiceType[]> {
    return this.http.post<any>(`${this.apiUrl}/admin/orders/invoice/types`, {
      data: { order_uid: orderUid }
    }).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * Get invoices for order(s)
   * Backend returns a map { order_uid: Invoice[] }, we flatten it to Invoice[]
   */
  getInvoicesForOrders(orderUids: string[]): Observable<Invoice[]> {
    return this.http.post<any>(`${this.apiUrl}/admin/orders/invoice/list`, {
      data: orderUids
    }).pipe(
      map((response: any) => {
        const invoicesMap = response.data || {};
        // Flatten the map to a single array of invoices
        const invoices: Invoice[] = [];
        for (const orderUid of orderUids) {
          const orderInvoices = invoicesMap[orderUid];
          if (orderInvoices && Array.isArray(orderInvoices)) {
            invoices.push(...orderInvoices);
          }
        }
        // Sort by created_at descending (newest first)
        return invoices.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
    );
  }

  /**
   * Download invoice file - returns blob URL
   */
  downloadInvoice(invoiceUid: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/admin/orders/invoice/${invoiceUid}`, {
      responseType: 'blob'
    });
  }

  /**
   * Open invoice - either opens link or downloads file
   */
  openInvoice(invoice: Invoice): void {
    if (invoice.response_type === 'link' && invoice.response_data) {
      // Open link in new tab
      window.open(invoice.response_data, '_blank');
    } else if (invoice.response_type === 'file') {
      // Download file
      this.downloadInvoice(invoice.uid).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = invoice.file_name || `invoice-${invoice.uid}`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('Failed to download invoice:', err);
        }
      });
    }
  }
}
