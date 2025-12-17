import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, from } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ProductImageResponse, ProductImagesMap, CachedProductImage } from '../models/product-image.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const DB_NAME = 'ProductImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

@Injectable({
  providedIn: 'root'
})
export class ProductImageCacheService {
  private readonly apiUrl = environment.apiUrl;
  private db: IDBDatabase | null = null;
  private dbReady = new BehaviorSubject<boolean>(false);

  // In-memory cache of blob URLs for quick access
  private blobUrlCache = new Map<string, string>();

  // Placeholder image for products without images
  private readonly placeholderUrl = 'assets/images/product-placeholder.svg';

  constructor(private http: HttpClient) {
    this.initDatabase();
  }

  /**
   * Initialize IndexedDB database
   */
  private initDatabase(): void {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available, image caching disabled');
      this.dbReady.next(true); // Still mark as ready but without DB
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Failed to open IndexedDB:', event);
      this.dbReady.next(true); // Mark as ready even on error
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      this.dbReady.next(true);
      console.log('[ImageCache] IndexedDB initialized');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for images
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'productUid' });
        store.createIndex('lastUpdate', 'lastUpdate', { unique: false });
      }
    };
  }

  /**
   * Wait for database to be ready
   */
  private waitForDb(): Observable<boolean> {
    return this.dbReady.asObservable().pipe(
      switchMap(ready => {
        if (ready) {
          return of(true);
        }
        return this.dbReady.asObservable();
      })
    );
  }

  /**
   * Load main images for multiple products from API and cache them
   */
  loadMainImages(productUids: string[]): Observable<Map<string, string>> {
    if (productUids.length === 0) {
      return of(new Map());
    }

    return this.waitForDb().pipe(
      switchMap(() => this.getFromCache(productUids)),
      switchMap(cachedImages => {
        const cachedMap = new Map<string, string>();
        const uidsToFetch: string[] = [];

        // Check which images we already have in cache
        productUids.forEach(uid => {
          const cached = cachedImages.get(uid);
          if (cached) {
            // Generate or use existing blob URL
            const blobUrl = this.getBlobUrl(cached);
            cachedMap.set(uid, blobUrl);
          } else {
            uidsToFetch.push(uid);
          }
        });

        // If all images are cached, return immediately
        if (uidsToFetch.length === 0) {
          console.log(`[ImageCache] All ${productUids.length} images loaded from cache`);
          return of(cachedMap);
        }

        console.log(`[ImageCache] Fetching ${uidsToFetch.length} images from API (${cachedMap.size} from cache)`);

        // Fetch missing images from API
        return this.fetchImagesFromApi(uidsToFetch).pipe(
          tap(apiImages => {
            // Store fetched images in cache
            apiImages.forEach((image, uid) => {
              this.storeInCache({
                productUid: uid,
                fileData: image.file_data,
                lastUpdate: image.last_update
              });
            });
          }),
          map(apiImages => {
            // Merge cached and API results
            apiImages.forEach((image, uid) => {
              const blobUrl = this.createBlobUrl(image.file_data);
              this.blobUrlCache.set(uid, blobUrl);
              cachedMap.set(uid, blobUrl);
            });
            return cachedMap;
          }),
          catchError(error => {
            console.error('Error fetching images from API:', error);
            return of(cachedMap); // Return whatever we have from cache
          })
        );
      })
    );
  }

  /**
   * Get image URL for a product (from cache or placeholder)
   */
  getImageUrl(productUid: string): string {
    return this.blobUrlCache.get(productUid) || this.placeholderUrl;
  }

  /**
   * Check if image URL is available in memory cache
   */
  hasImageUrl(productUid: string): boolean {
    return this.blobUrlCache.has(productUid);
  }

  /**
   * Get the placeholder image URL
   */
  getPlaceholderUrl(): string {
    return this.placeholderUrl;
  }

  /**
   * Check if an image needs refresh based on last_update timestamp
   */
  needsRefresh(productUid: string, serverLastUpdate: string): Observable<boolean> {
    return this.waitForDb().pipe(
      switchMap(() => this.getFromCache([productUid])),
      map(cached => {
        const cachedImage = cached.get(productUid);
        if (!cachedImage) {
          return true; // Not in cache, needs fetch
        }
        return cachedImage.lastUpdate !== serverLastUpdate;
      })
    );
  }

  /**
   * Clear cache for a specific product or all products
   */
  clearCache(productUid?: string): Observable<void> {
    return this.waitForDb().pipe(
      switchMap(() => {
        if (!this.db) {
          // Clear only memory cache
          if (productUid) {
            this.revokeBlobUrl(productUid);
            this.blobUrlCache.delete(productUid);
          } else {
            this.blobUrlCache.forEach((_, uid) => this.revokeBlobUrl(uid));
            this.blobUrlCache.clear();
          }
          return of(undefined);
        }

        return from(new Promise<void>((resolve, reject) => {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          if (productUid) {
            // Delete specific image
            const request = store.delete(productUid);
            request.onsuccess = () => {
              this.revokeBlobUrl(productUid);
              this.blobUrlCache.delete(productUid);
              resolve();
            };
            request.onerror = () => reject(request.error);
          } else {
            // Clear all images
            const request = store.clear();
            request.onsuccess = () => {
              this.blobUrlCache.forEach((_, uid) => this.revokeBlobUrl(uid));
              this.blobUrlCache.clear();
              resolve();
            };
            request.onerror = () => reject(request.error);
          }
        }));
      })
    );
  }

  /**
   * Fetch images from API
   */
  private fetchImagesFromApi(productUids: string[]): Observable<Map<string, ProductImageResponse>> {
    const payload = { data: productUids };

    return this.http.post<ApiResponse<ProductImagesMap>>(
      `${this.apiUrl}/frontend/product/images`,
      payload
    ).pipe(
      map(response => {
        const result = new Map<string, ProductImageResponse>();
        if (response.success && response.data) {
          Object.entries(response.data).forEach(([uid, image]) => {
            result.set(uid, image);
          });
        }
        return result;
      })
    );
  }

  /**
   * Get images from IndexedDB cache
   */
  private getFromCache(productUids: string[]): Observable<Map<string, CachedProductImage>> {
    if (!this.db) {
      return of(new Map());
    }

    return from(new Promise<Map<string, CachedProductImage>>((resolve, reject) => {
      const result = new Map<string, CachedProductImage>();
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;
      productUids.forEach(uid => {
        const request = store.get(uid);
        request.onsuccess = () => {
          if (request.result) {
            result.set(uid, request.result);
          }
          completed++;
          if (completed === productUids.length) {
            resolve(result);
          }
        };
        request.onerror = () => {
          completed++;
          if (completed === productUids.length) {
            resolve(result);
          }
        };
      });

      // Handle empty array case
      if (productUids.length === 0) {
        resolve(result);
      }
    }));
  }

  /**
   * Store image in IndexedDB cache
   */
  private storeInCache(image: CachedProductImage): void {
    if (!this.db) {
      return;
    }

    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(image);
  }

  /**
   * Get blob URL for a cached image (creates one if not exists)
   */
  private getBlobUrl(cached: CachedProductImage): string {
    // Check if we already have a blob URL in memory
    const existing = this.blobUrlCache.get(cached.productUid);
    if (existing) {
      return existing;
    }

    // Create new blob URL from base64 data
    const blobUrl = this.createBlobUrl(cached.fileData);
    this.blobUrlCache.set(cached.productUid, blobUrl);
    return blobUrl;
  }

  /**
   * Create a blob URL from base64 encoded data
   */
  private createBlobUrl(base64Data: string): string {
    try {
      // Handle data URI format (e.g., "data:image/png;base64,...")
      let base64 = base64Data;
      let mimeType = 'image/png'; // Default

      if (base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64 = matches[2];
        }
      }

      // Decode base64 to binary
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and URL
      const blob = new Blob([bytes], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating blob URL from base64:', error);
      return this.placeholderUrl;
    }
  }

  /**
   * Revoke a blob URL to free memory
   */
  private revokeBlobUrl(productUid: string): void {
    const url = this.blobUrlCache.get(productUid);
    if (url && url !== this.placeholderUrl) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        // Ignore errors when revoking
      }
    }
  }
}
