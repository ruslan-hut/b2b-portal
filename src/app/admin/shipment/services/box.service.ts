import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ShipmentBox } from '../models/shipment-box.model';

@Injectable({
  providedIn: 'root'
})
export class BoxService {
  private apiUrl = `${environment.apiUrl}/admin/shipment/boxes`;

  constructor(private http: HttpClient) {}

  // Upsert boxes (create/update)
  upsertBoxes(boxes: Partial<ShipmentBox>[]): Observable<{ data: string[] }> {
    return this.http.post<{ data: string[] }>(this.apiUrl, { data: boxes });
  }

  // List boxes with pagination
  listBoxes(page: number = 1, count: number = 20): Observable<{
    data: ShipmentBox[];
    pagination?: { total: number; total_pages: number };
  }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<any>(this.apiUrl, { params });
  }

  // Get boxes by UIDs
  getBoxesByUIDs(uids: string[]): Observable<{ data: ShipmentBox[] }> {
    return this.http.post<{ data: ShipmentBox[] }>(`${this.apiUrl}/batch`, { data: uids });
  }

  // Delete boxes
  deleteBoxes(uids: string[]): Observable<{ data: string }> {
    return this.http.post<{ data: string }>(`${this.apiUrl}/delete`, { data: uids });
  }

  // Get active boxes (for dropdown)
  getActiveBoxes(storeUID?: string): Observable<{ data: ShipmentBox[] }> {
    let params = new HttpParams();
    if (storeUID) {
      params = params.set('store_uid', storeUID);
    }
    return this.http.get<{ data: ShipmentBox[] }>(`${this.apiUrl}/active`, { params });
  }
}
