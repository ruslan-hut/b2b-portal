import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, map, catchError, switchMap } from 'rxjs/operators';
import { Product, ProductCategory, BackendProduct } from '../models/product.model';
import { ProductMapper } from '../mappers/product.mapper';
import { environment } from '../../../environments/environment';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '../mock-data/products.mock';
import { TranslationService } from './translation.service';

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

interface BatchProductDescription {
  uid: string;
  name: string;
  description: string;
}

interface CachedDescription {
  uid: string;
  name: string;
  description: string;
  language: string;
  timestamp: number; // Unix timestamp
}

interface DescriptionCache {
  [productUid: string]: {
    [language: string]: CachedDescription;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private viewModeSubject = new BehaviorSubject<'grid' | 'bulk'>('bulk');
  public viewMode$ = this.viewModeSubject.asObservable();

  private readonly apiUrl = environment.apiUrl;
  private readonly CACHE_KEY = 'product_descriptions_cache';
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) { }

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

        const backendProducts = response.data;

        if (backendProducts.length === 0) {
          return of([]);
        }

        // Extract all product UIDs
        const productUids = backendProducts.map(p => p.uid);

        // Get current language from translation service
        const currentLanguage = this.translationService.getCurrentLanguage();

        // Fetch all descriptions in ONE batch request using current language
        return this.getBatchProductDescriptions(productUids, currentLanguage).pipe(
          map(descriptionsMap => {
            // Map backend products with their descriptions
            return backendProducts.map(backendProduct => {
              const desc = descriptionsMap.get(backendProduct.uid);
              return ProductMapper.fromBackend(backendProduct, desc?.name, desc?.description);
            });
          })
        );
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
        const currentLanguage = this.translationService.getCurrentLanguage();

        // Fetch description using current language
        return this.getProductDescription(uid, currentLanguage).pipe(
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
   * Fetch product description (multi-language) - SINGLE product
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

  /**
   * Fetch product descriptions in BATCH - all products in ONE request
   * Uses localStorage cache to avoid redundant API calls
   */
  getBatchProductDescriptions(productUids: string[], language: string = 'en'): Observable<Map<string, BatchProductDescription>> {
    if (productUids.length === 0) {
      return of(new Map());
    }

    // Get cached descriptions
    const cache = this.getDescriptionCache();
    const now = Date.now();
    const resultMap = new Map<string, BatchProductDescription>();
    const uidsToFetch: string[] = [];

    // Check cache for each product
    productUids.forEach(uid => {
      const cached = cache[uid]?.[language];

      if (cached && (now - cached.timestamp) < this.CACHE_DURATION_MS) {
        // Cache hit and still valid (less than 1 day old)
        resultMap.set(uid, {
          uid: cached.uid,
          name: cached.name,
          description: cached.description
        });
      } else {
        // Cache miss or expired
        uidsToFetch.push(uid);
      }
    });

    // If all descriptions are cached and valid, return immediately
    if (uidsToFetch.length === 0) {
      console.log(`[Cache] All ${productUids.length} descriptions loaded from cache for language: ${language}`);
      return of(resultMap);
    }

    console.log(`[Cache] Loading ${uidsToFetch.length} descriptions from API (${resultMap.size} from cache) for language: ${language}`);

    // Fetch only missing/expired descriptions
    const payload = {
      product_uids: uidsToFetch,
      language: language
    };

    return this.http.post<ApiResponse<BatchProductDescription[]>>(
      `${this.apiUrl}/product/descriptions/batch`,
      payload
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          return resultMap;
        }

        // Add fetched descriptions to result and cache
        response.data.forEach(desc => {
          resultMap.set(desc.uid, desc);

          // Update cache
          this.cacheDescription(desc.uid, desc.name, desc.description, language);
        });

        return resultMap;
      }),
      catchError(error => {
        console.error('Error fetching batch product descriptions:', error);
        // Return whatever we have from cache even if API fails
        return of(resultMap);
      })
    );
  }

  /**
   * Get description cache from localStorage
   */
  private getDescriptionCache(): DescriptionCache {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('Error reading description cache:', error);
      return {};
    }
  }

  /**
   * Save description to cache
   */
  private cacheDescription(uid: string, name: string, description: string, language: string): void {
    try {
      const cache = this.getDescriptionCache();

      if (!cache[uid]) {
        cache[uid] = {};
      }

      cache[uid][language] = {
        uid,
        name,
        description,
        language,
        timestamp: Date.now()
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error caching description:', error);
    }
  }

  /**
   * Clear description cache (useful for debugging or manual cache invalidation)
   */
  clearDescriptionCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      console.log('[Cache] Product description cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalProducts: number; languages: string[]; oldestEntry: Date | null } {
    const cache = this.getDescriptionCache();
    const languages = new Set<string>();
    let oldestTimestamp = Date.now();

    Object.values(cache).forEach(productCache => {
      Object.values(productCache).forEach(desc => {
        languages.add(desc.language);
        if (desc.timestamp < oldestTimestamp) {
          oldestTimestamp = desc.timestamp;
        }
      });
    });

    return {
      totalProducts: Object.keys(cache).length,
      languages: Array.from(languages),
      oldestEntry: oldestTimestamp < Date.now() ? new Date(oldestTimestamp) : null
    };
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
