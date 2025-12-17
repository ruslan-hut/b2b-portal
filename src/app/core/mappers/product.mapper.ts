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
      // Backend provides prices in cents - convert to dollars for display
      // Note: For client-specific pricing with discount/VAT, use cart item prices (backend-calculated)
      price: backendProduct.price ? backendProduct.price / 100 : 0,
      category: categoryName || backendProduct.category || 'Uncategorized',
      imageUrl: backendProduct.image || undefined,
      // inStock will be computed using per-store availability. Default to active flag.
      inStock: backendProduct.active !== false,
      sku: backendProduct.sku || '',
      // quantity (CRM global quantity) is deprecated/removed on newer backends; keep if present
      quantity: backendProduct.quantity,
      active: backendProduct.active,
      // Badge flags for New and Hot Sale
      // Support both snake_case (backend) and camelCase (mock data) for compatibility
      isNew: backendProduct.is_new || (backendProduct as any).isNew || false,
      isHotSale: backendProduct.is_hot_sale || (backendProduct as any).isHotSale || false,
      sortOrder: backendProduct.sort_order || (backendProduct as any).sortOrder
    };
  }
}
