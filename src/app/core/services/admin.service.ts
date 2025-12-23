import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  orders_by_status: { [status: string]: number };
  total_clients: number;
  total_products: number;
}

export interface TableInfo {
  name: string;
}

export interface TableRecord {
  [key: string]: any;
}

export interface TableRecordsResponse {
  success: boolean;
  data: TableRecord[];
  metadata?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface AdminProductWithDetails {
  uid: string;
  sku: string;
  image?: string;
  category_uid: string;
  active: boolean;
  sort_order?: number;
  is_new?: boolean;
  product_name?: string;
  product_description?: string;
  category_name?: string;
  category_description?: string;
  price?: number;
  quantity?: number;
}

export interface AdminProductsResponse {
  success: boolean;
  data: AdminProductWithDetails[];
  pagination?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

export interface DiscountScale {
  store_uid: string;
  sum_purchase: number;  // in cents
  discount: number;      // percentage 0-100
  currency_code: string;
  last_update?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get dashboard statistics
   * @param storeUID Optional store UID to filter statistics by store
   */
  getDashboardStats(storeUID?: string): Observable<DashboardStats> {
    let url = `${this.apiUrl}/admin/dashboard`;
    if (storeUID) {
      url += `?store_uid=${encodeURIComponent(storeUID)}`;
    }
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        // Handle both { success: true, data: {...} } and direct data responses
        return response.data || response;
      })
    );
  }

  /**
   * List all database tables
   */
  listTables(): Observable<TableInfo[]> {
    return this.http.get<any>(`${this.apiUrl}/admin/tables`).pipe(
      map((response: any) => {
        // Handle both { success: true, data: [...] } and direct array responses
        return response.data || response;
      })
    );
  }

  /**
   * Search records in a database table
   */
  searchTableRecords(
    tableName: string,
    page: number = 1,
    count: number = 100,
    search?: string,
    field?: string
  ): Observable<TableRecordsResponse> {
    const url = `${this.apiUrl}/admin/tables/${tableName}/records`;

    return this.http.post<TableRecordsResponse>(url, {
      page,
      count,
      data: {
        search,
        field
      }
    });
  }

  /**
   * Get products with details (descriptions, category descriptions, prices, quantities)
   */
  getProductsWithDetails(params: {
    page?: number;
    count?: number;
    language?: string;
    store?: string;
    price_type?: string;
    category?: string;
  }): Observable<AdminProductsResponse> {
    let httpParams = new HttpParams();
    
    if (params.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.count) {
      httpParams = httpParams.set('count', params.count.toString());
    }
    if (params.language) {
      httpParams = httpParams.set('language', params.language);
    }
    if (params.store) {
      httpParams = httpParams.set('store', params.store);
    }
    if (params.price_type) {
      httpParams = httpParams.set('price_type', params.price_type);
    }
    if (params.category) {
      httpParams = httpParams.set('category', params.category);
    }

    return this.http.get<AdminProductsResponse>(`${this.apiUrl}/admin/products/details`, { params: httpParams });
  }

  /**
   * List all stores
   */
  listStores(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/store/`).pipe(
      map((response: any) => {
        return response.data || response || [];
      })
    );
  }

  /**
   * List all price types
   */
  listPriceTypes(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/price_type/`).pipe(
      map((response: any) => {
        return response.data || response || [];
      })
    );
  }

  /**
   * List all categories
   */
  listCategories(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/category/`).pipe(
      map((response: any) => {
        return response.data || response || [];
      })
    );
  }

  /**
   * Get distinct languages from product descriptions
   * This queries the database to get all available languages
   */
  getAvailableLanguages(): Observable<string[]> {
    // For now, return common languages. In the future, this could query the database
    // to get distinct languages from product_descriptions table
    return of(['en', 'uk']);
  }

  /**
   * Get discount scales for a store
   * @param storeUID Store UID (required)
   */
  getDiscountScales(storeUID: string): Observable<DiscountScale[]> {
    const url = `${this.apiUrl}/admin/discount_scale?store_uid=${encodeURIComponent(storeUID)}`;
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        // Handle both { success: true, data: [...] } and direct array responses
        return response.data || response || [];
      })
    );
  }
}

