import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Webhook {
  uid: string;
  name: string;
  url: string;
  event: string;
  store_uid?: string | null;
  auth_header?: string;
  auth_value?: string;
  active: boolean;
  created_at?: string;
  last_update?: string;
}

export interface WebhookDelivery {
  uid: string;
  webhook_uid: string;
  event: string;
  object_uid: string;
  request_url: string;
  request_body?: string;
  response_code: number;
  response_body?: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface WebhooksResponse {
  success: boolean;
  data: Webhook[];
  pagination?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface DeliveriesResponse {
  success: boolean;
  data: WebhookDelivery[];
  pagination?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface WebhookTestResponse {
  success: boolean;
  status_code: number;
  response_body?: string;
  error?: string;
}

export interface WebhookUpsertRequest {
  uid?: string;
  name: string;
  url: string;
  event: string;
  store_uid?: string | null;
  auth_header?: string;
  auth_value?: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WebhookService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * List webhooks with pagination
   */
  listWebhooks(page: number = 1, count: number = 50): Observable<WebhooksResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());

    return this.http.get<WebhooksResponse>(`${this.apiUrl}/admin/webhooks`, { params });
  }

  /**
   * Get webhooks by UIDs
   */
  getWebhooksByUIDs(uids: string[]): Observable<Webhook[]> {
    return this.http.post<any>(`${this.apiUrl}/admin/webhooks/batch`, { data: uids }).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * Create or update webhooks
   */
  upsertWebhooks(webhooks: WebhookUpsertRequest[]): Observable<string[]> {
    return this.http.post<any>(`${this.apiUrl}/admin/webhooks`, { data: webhooks }).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * Delete webhooks by UIDs
   */
  deleteWebhooks(uids: string[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/webhooks/delete`, { data: uids });
  }

  /**
   * Update webhook active status
   */
  updateWebhookActive(uid: string, active: boolean): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/webhooks/active`, { data: { uid, active } });
  }

  /**
   * Test webhook configuration
   */
  testWebhook(url: string, authHeader?: string, authValue?: string): Observable<WebhookTestResponse> {
    return this.http.post<any>(`${this.apiUrl}/admin/webhooks/test`, {
      data: {
        url,
        auth_header: authHeader || '',
        auth_value: authValue || ''
      }
    }).pipe(
      map((response: any) => response.data || response)
    );
  }

  /**
   * List all webhook deliveries with pagination
   */
  listDeliveries(page: number = 1, count: number = 50): Observable<DeliveriesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());

    return this.http.get<DeliveriesResponse>(`${this.apiUrl}/admin/webhooks/deliveries`, { params });
  }

  /**
   * List deliveries for a specific webhook
   */
  listDeliveriesByWebhook(webhookUID: string, page: number = 1, count: number = 50): Observable<DeliveriesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());

    return this.http.get<DeliveriesResponse>(`${this.apiUrl}/admin/webhooks/deliveries/${webhookUID}`, { params });
  }

  /**
   * Cleanup old delivery logs
   */
  cleanupDeliveries(retentionDays?: number): Observable<any> {
    let params = new HttpParams();
    if (retentionDays) {
      params = params.set('retention_days', retentionDays.toString());
    }
    return this.http.delete<any>(`${this.apiUrl}/admin/webhooks/deliveries/cleanup`, { params });
  }
}
