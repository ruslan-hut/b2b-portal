import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { delay, map, catchError, switchMap } from 'rxjs/operators';
import { Product, ProductCategory, BackendProduct } from '../models/product.model';
import { ProductMapper } from '../mappers/product.mapper';
import { environment } from '../../../environments/environment';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '../mock-data/products.mock';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface ProductDescription {
  product_uid: string;
  language: string;
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private viewModeSubject = new BehaviorSubject<'grid' | 'bulk'>('bulk');
  public viewMode$ = this.viewModeSubject.asObservable();

  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getViewMode(): 'grid' | 'bulk' {
    return this.viewModeSubject.value;
  }

  setViewMode(mode: 'grid' | 'bulk'): void {
    this.viewModeSubject.next(mode);
  }

  toggleViewMode(): void {
    const currentMode = this.viewModeSubject.value;
    this.viewModeSubject.next(currentMode === 'grid' ? 'bulk' : 'grid');
  }

  getProducts(offset: number = 0, limit: number = 100): Observable<Product[]> {
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<BackendProduct[]>>(`${this.apiUrl}/product/`, { params }).pipe(
      switchMap(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch products');
        }

        // For each product, fetch descriptions
        const products$ = response.data.map(backendProduct =>
          this.getProductDescription(backendProduct.uid).pipe(
            map(desc => ProductMapper.fromBackend(backendProduct, desc?.name, desc?.description)),
            catchError(() => of(ProductMapper.fromBackend(backendProduct)))
          )
        );

        return products$.length > 0 ? forkJoin(products$) : of([]);
      }),
      catchError(error => {
        console.error('Error fetching products, using mock data:', error);
        return of(MOCK_PRODUCTS);
      })
    );
  }

  getProductById(uid: string): Observable<Product | undefined> {
    return this.http.get<ApiResponse<BackendProduct>>(`${this.apiUrl}/product/${uid}`).pipe(
      switchMap(response => {
        if (!response.success) {
          throw new Error(response.message || 'Product not found');
        }

        const backendProduct = response.data;

        // Fetch description
        return this.getProductDescription(uid).pipe(
          map(desc => ProductMapper.fromBackend(backendProduct, desc?.name, desc?.description))
        );
      }),
      catchError(error => {
        console.error('Error fetching product:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Fetch product description (multi-language)
   */
  getProductDescription(productUid: string, language: string = 'en'): Observable<ProductDescription | null> {
    return this.http.get<ApiResponse<ProductDescription[]>>(
      `${this.apiUrl}/product/description/${productUid}`
    ).pipe(
      map(response => {
        if (!response.success || !response.data.length) {
          return null;
        }

        // Find description in requested language, or fallback to first available
        return response.data.find(d => d.language === language) || response.data[0];
      }),
      catchError(error => {
        console.error('Error fetching product description:', error);
        return of(null);
      })
    );
  }

  getCategories(): Observable<ProductCategory[]> {
    // TODO: Replace with actual API call
    return of(MOCK_CATEGORIES).pipe(delay(300));
  }

  searchProducts(query: string): Observable<Product[]> {
    return this.getProducts().pipe(
      map(products => {
        const lowerQuery = query.toLowerCase();
        return products.filter(p =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery) ||
          p.sku.toLowerCase().includes(lowerQuery)
        );
      })
    );
  }

  /**
   * Validate product stock before adding to cart
   */
  validateStock(productId: string, requestedQuantity: number): Observable<boolean> {
    return this.http.get<ApiResponse<BackendProduct>>(`${this.apiUrl}/product/${productId}`).pipe(
      map(response => {
        if (!response.success) {
          return false;
        }

        const product = response.data;
        return product.active && product.quantity >= requestedQuantity;
      }),
      catchError(() => of(false))
    );
  }
}
