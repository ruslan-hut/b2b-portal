import { TestBed } from '@angular/core/testing';
import { PricingHelperService } from './pricing-helper.service';
import { Product } from '../../../core/models/product.model';
import { OrderItem } from '../../../core/models/order.model';

describe('PricingHelperService', () => {
  let service: PricingHelperService;
  let mockProduct: Product;
  let mockCartItems: OrderItem[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PricingHelperService);

    // Mock product
    mockProduct = {
      id: 'prod-1',
      name: 'Test Product',
      description: 'Test Description',
      price: 100, // Base price
      sku: 'SKU-001',
      category: 'Test Category',
      inStock: true,
      availableQuantity: 10,
      sortOrder: 1
    };

    // Mock cart items
    mockCartItems = [];
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculatePreviewPriceWithVat', () => {
    it('should calculate price with VAT and no discount', () => {
      const result = service.calculatePreviewPriceWithVat(100, 0, 20);
      expect(result).toBe(120); // 100 * 1.20
    });

    it('should calculate price with discount and VAT', () => {
      const result = service.calculatePreviewPriceWithVat(100, 10, 20);
      expect(result).toBe(108); // (100 * 0.9) * 1.20 = 90 * 1.20 = 108
    });

    it('should handle zero discount', () => {
      const result = service.calculatePreviewPriceWithVat(100, 0, 0);
      expect(result).toBe(100);
    });

    it('should handle zero VAT', () => {
      const result = service.calculatePreviewPriceWithVat(100, 10, 0);
      expect(result).toBe(90); // 100 * 0.9
    });

    it('should calculate correctly with 25% discount and 20% VAT', () => {
      const result = service.calculatePreviewPriceWithVat(100, 25, 20);
      expect(result).toBe(90); // (100 * 0.75) * 1.20 = 75 * 1.20 = 90
    });
  });

  describe('getAuthoritativePriceWithVat', () => {
    it('should return null when product not in cart', () => {
      const result = service.getAuthoritativePriceWithVat(mockProduct, mockCartItems);
      expect(result).toBeNull();
    });

    it('should return backend-calculated price when product in cart', () => {
      mockCartItems = [{
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        price: 100,
        subtotal: 240, // Backend-calculated: 120 per unit * 2
        sortOrder: 1
      }];

      const result = service.getAuthoritativePriceWithVat(mockProduct, mockCartItems);
      expect(result).toBe(120); // 240 / 2
    });

    it('should return null when cart item has no subtotal', () => {
      mockCartItems = [{
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        price: 100,
        subtotal: 0,
        sortOrder: 1
      }];

      const result = service.getAuthoritativePriceWithVat(mockProduct, mockCartItems);
      expect(result).toBeNull();
    });

    it('should return null when cart item has zero quantity', () => {
      mockCartItems = [{
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 0,
        price: 100,
        subtotal: 0,
        sortOrder: 1
      }];

      const result = service.getAuthoritativePriceWithVat(mockProduct, mockCartItems);
      expect(result).toBeNull();
    });
  });

  describe('getDisplayPriceWithVat', () => {
    it('should return authoritative price when product in cart', () => {
      mockCartItems = [{
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        price: 100,
        subtotal: 240,
        sortOrder: 1
      }];

      const result = service.getDisplayPriceWithVat(mockProduct, mockCartItems, 10, 20);
      expect(result).toBe(120); // Backend value: 240 / 2
    });

    it('should return priceWithVat from product when not in cart and no discount', () => {
      const productWithPrices = {
        ...mockProduct,
        priceWithVat: 120
      };

      const result = service.getDisplayPriceWithVat(productWithPrices, mockCartItems, 0, 20);
      expect(result).toBe(120); // priceWithVat from product
    });

    it('should return priceFinal from product when not in cart with discount', () => {
      const productWithPrices = {
        ...mockProduct,
        priceFinal: 108
      };

      const result = service.getDisplayPriceWithVat(productWithPrices, mockCartItems, 10, 20);
      expect(result).toBe(108); // priceFinal from product
    });

    it('should calculate preview when product not in cart and no backend prices', () => {
      const result = service.getDisplayPriceWithVat(mockProduct, mockCartItems, 10, 20);
      expect(result).toBe(108); // Preview: (100 * 0.9) * 1.20
    });

    it('should return base price when no discount and no priceWithVat', () => {
      const result = service.getDisplayPriceWithVat(mockProduct, mockCartItems, 0, 20);
      expect(result).toBe(100); // Fallback to base price
    });
  });

  describe('getOriginalPriceWithVat', () => {
    it('should return priceWithVat from product when available', () => {
      const productWithPrices = {
        ...mockProduct,
        priceWithVat: 120
      };

      const result = service.getOriginalPriceWithVat(productWithPrices);
      expect(result).toBe(120);
    });

    it('should return base price when priceWithVat not available', () => {
      spyOn(console, 'warn'); // Suppress console warning in test

      const result = service.getOriginalPriceWithVat(mockProduct);
      expect(result).toBe(100); // Fallback to base price
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('getItemSubtotalWithVat', () => {
    it('should return 0 when quantity is 0', () => {
      const result = service.getItemSubtotalWithVat(mockProduct, 0, mockCartItems, 10, 20);
      expect(result).toBe(0);
    });

    it('should return backend subtotal when quantity matches cart item', () => {
      mockCartItems = [{
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        price: 100,
        subtotal: 240, // Backend value
        sortOrder: 1
      }];

      const result = service.getItemSubtotalWithVat(mockProduct, 2, mockCartItems, 10, 20);
      expect(result).toBe(240); // Backend subtotal
    });

    it('should calculate preview when quantity does not match cart item', () => {
      mockCartItems = [{
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 2,
        price: 100,
        subtotal: 240,
        sortOrder: 1
      }];

      const result = service.getItemSubtotalWithVat(mockProduct, 3, mockCartItems, 10, 20);
      // Preview calculation: getDisplayPriceWithVat returns 120, * 3 = 360
      expect(result).toBe(360);
    });

    it('should calculate preview when product not in cart', () => {
      const productWithPrices = {
        ...mockProduct,
        priceWithVat: 120
      };

      const result = service.getItemSubtotalWithVat(productWithPrices, 2, mockCartItems, 0, 20);
      expect(result).toBe(240); // priceWithVat (120) * 2
    });

    it('should handle negative quantity gracefully', () => {
      const result = service.getItemSubtotalWithVat(mockProduct, -1, mockCartItems, 10, 20);
      expect(result).toBe(0);
    });
  });

  describe('hasDiscount', () => {
    it('should return false when discount is 0', () => {
      expect(service.hasDiscount(0)).toBe(false);
    });

    it('should return true when discount is greater than 0', () => {
      expect(service.hasDiscount(10)).toBe(true);
      expect(service.hasDiscount(25)).toBe(true);
      expect(service.hasDiscount(100)).toBe(true);
    });

    it('should return false when discount is negative', () => {
      expect(service.hasDiscount(-5)).toBe(false);
    });
  });
});
