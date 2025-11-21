import { Product, BackendProduct } from '../models/product.model';

export class ProductMapper {
  /**
   * Convert backend product to frontend format
   * @param backendProduct - Backend product data
   * @param name - Product name (from description)
   * @param description - Product description (from description)
   * @param categoryName - Category name (resolved from category_uid)
   */
  static fromBackend(
    backendProduct: BackendProduct, 
    name?: string, 
    description?: string,
    categoryName?: string
  ): Product {
    return {
      id: backendProduct.uid,
      name: name || backendProduct.name || 'Unknown Product',
      description: description || '',
      // Backend no longer provides a single product.price; prices are per price-type.
      // Set to 0 here; ProductService will populate per-user price using batch price endpoints.
      price: 0,
      category: categoryName || backendProduct.category || 'Uncategorized',
      imageUrl: backendProduct.image || undefined,
      // inStock will be computed using per-store availability. Default to active flag.
      inStock: backendProduct.active !== false,
      sku: backendProduct.sku || '',
      // quantity (CRM global quantity) is deprecated/removed on newer backends; keep if present
      quantity: backendProduct.quantity,
      active: backendProduct.active
    };
  }
}
