/**
 * Product image response from the API
 */
export interface ProductImageResponse {
  file_data: string;    // Base64 encoded image data
  last_update: string;  // ISO 8601 timestamp
}

/**
 * Map of product UIDs to their main images
 */
export type ProductImagesMap = Record<string, ProductImageResponse>;

/**
 * Cached product image entry for IndexedDB storage
 */
export interface CachedProductImage {
  productUid: string;
  fileData: string;      // Base64 encoded data
  lastUpdate: string;    // ISO 8601 timestamp for cache invalidation
  blobUrl?: string;      // Generated blob URL for display
}
