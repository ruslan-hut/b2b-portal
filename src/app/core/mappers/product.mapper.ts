import { Product, BackendProduct } from '../models/product.model';

export class ProductMapper {
  /**
   * Convert backend product to frontend format
   */
  static fromBackend(backendProduct: BackendProduct, name?: string, description?: string): Product {
    return {
      id: backendProduct.uid,
      name: name || backendProduct.name || 'Unknown Product',
      description: description || '',
      price: backendProduct.price / 100, // Convert from cents
      category: backendProduct.category || 'Uncategorized',
      imageUrl: backendProduct.image || undefined,
      inStock: backendProduct.active && backendProduct.quantity > 0,
      sku: backendProduct.sku || '',
      quantity: backendProduct.quantity,
      active: backendProduct.active
    };
  }
}
