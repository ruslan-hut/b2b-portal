import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkCardListComponent } from './bulk-card-list.component';
import { BulkProductCardComponent } from '../bulk-product-card/bulk-product-card.component';
import { CoreModule } from '../../../../core/core.module';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';
import { Currency } from '../../../../core/models/currency.model';

describe('BulkCardListComponent', () => {
  let component: BulkCardListComponent;
  let fixture: ComponentFixture<BulkCardListComponent>;
  let mockProducts: Product[];
  let mockCartItems: OrderItem[];
  let mockCurrency: Currency;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkCardListComponent, BulkProductCardComponent],
      imports: [CoreModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkCardListComponent);
    component = fixture.componentInstance;

    mockProducts = [
      {
        id: 'prod-1',
        sku: 'TEST-001',
        name: 'Product 1',
        description: 'Description for Product 1',
        category: 'Category A',
        price: 2000,
        inStock: true,
        availableQuantity: 100,
        imageUrl: 'image1.jpg',
        isNew: false,
        isHotSale: false,
        discountPercent: 0
      },
      {
        id: 'prod-2',
        sku: 'TEST-002',
        name: 'Product 2',
        description: 'Description for Product 2',
        category: 'Category B',
        price: 3000,
        inStock: true,
        availableQuantity: 50,
        imageUrl: 'image2.jpg',
        isNew: true,
        isHotSale: false,
        discountPercent: 10
      }
    ];

    mockCartItems = [
      {
        productId: 'prod-1',
        productName: 'Product 1',
        quantity: 5,
        price: 2000,
        subtotal: 100
      }
    ];

    mockCurrency = {
      code: 'USD',
      name: 'US Dollar',
      sign: '$',
      rate: 1
    };

    component.products = mockProducts;
    component.cartItems = mockCartItems;
    component.currency = mockCurrency;
    component.discount = 0;
    component.vatRate = 20;
    component.bulkQuantities = new Map([['prod-1', 5], ['prod-2', 0]]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Product Display', () => {
    it('should render a BulkProductCard for each product', () => {
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('app-bulk-product-card');
      expect(cards.length).toBe(2);
    });

    it('should show empty state when no products', () => {
      component.products = [];
      fixture.detectChanges();
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should not show empty state when products exist', () => {
      fixture.detectChanges();
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });
  });

  describe('Bulk Quantities', () => {
    it('should get bulk quantity from map', () => {
      expect(component.getBulkQuantity('prod-1')).toBe(5);
      expect(component.getBulkQuantity('prod-2')).toBe(0);
    });

    it('should return 0 for unknown product ID', () => {
      expect(component.getBulkQuantity('unknown')).toBe(0);
    });
  });

  describe('Cart Status', () => {
    it('should correctly identify items in cart', () => {
      expect(component.isInCart('prod-1')).toBe(true);
      expect(component.isInCart('prod-2')).toBe(false);
    });
  });

  describe('Card Expansion', () => {
    it('should start with no cards expanded', () => {
      expect(component.isExpanded('prod-1')).toBe(false);
      expect(component.isExpanded('prod-2')).toBe(false);
    });

    it('should expand card when toggled', () => {
      component.onCardToggle('prod-1');
      expect(component.isExpanded('prod-1')).toBe(true);
    });

    it('should collapse card when toggled again', () => {
      component.onCardToggle('prod-1');
      component.onCardToggle('prod-1');
      expect(component.isExpanded('prod-1')).toBe(false);
    });

    it('should collapse previous card when expanding new card', () => {
      component.onCardToggle('prod-1');
      expect(component.isExpanded('prod-1')).toBe(true);

      component.onCardToggle('prod-2');
      expect(component.isExpanded('prod-1')).toBe(false);
      expect(component.isExpanded('prod-2')).toBe(true);
    });
  });

  describe('Event Emissions', () => {
    it('should emit productSelect when product is selected', () => {
      spyOn(component.productSelect, 'emit');
      component.onProductSelect(mockProducts[0]);
      expect(component.productSelect.emit).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should emit quantityIncrement with product ID and product', () => {
      spyOn(component.quantityIncrement, 'emit');
      component.onQuantityIncrement(mockProducts[0]);
      expect(component.quantityIncrement.emit).toHaveBeenCalledWith({
        productId: 'prod-1',
        product: mockProducts[0]
      });
    });

    it('should emit quantityDecrement with product ID and product', () => {
      spyOn(component.quantityDecrement, 'emit');
      component.onQuantityDecrement(mockProducts[0]);
      expect(component.quantityDecrement.emit).toHaveBeenCalledWith({
        productId: 'prod-1',
        product: mockProducts[0]
      });
    });

    it('should emit quantityChange with product ID, product, and quantity', () => {
      spyOn(component.quantityChange, 'emit');
      component.onQuantityChange(mockProducts[0], 10);
      expect(component.quantityChange.emit).toHaveBeenCalledWith({
        productId: 'prod-1',
        product: mockProducts[0],
        quantity: 10
      });
    });

    it('should emit imageClick with imageUrl and altText', () => {
      spyOn(component.imageClick, 'emit');
      component.onImageClick(mockProducts[0], 'image1.jpg');
      expect(component.imageClick.emit).toHaveBeenCalledWith({
        imageUrl: 'image1.jpg',
        altText: 'Product 1'
      });
    });
  });

  describe('Price Calculations', () => {
    it('should use authoritative price from cart item', () => {
      // prod-1 is in cart with subtotal 100 and quantity 5
      const price = component.getPriceWithVat(mockProducts[0]);
      expect(price).toBe(20); // 100 / 5 = 20
    });

    it('should use preview price for items not in cart', () => {
      // prod-2 is not in cart, price is 3000 cents = $30
      // With 20% VAT: 30 * 1.2 = 36
      const price = component.getPriceWithVat(mockProducts[1]);
      expect(price).toBe(36);
    });

    it('should use preview price when quantity mismatch', () => {
      // Simulate user changed quantity to 10 but cart still shows 5
      component.bulkQuantities.set('prod-1', 10);
      // Should fall back to preview calculation
      const price = component.getPriceWithVat(mockProducts[0]);
      // 2000 cents = $20, with 20% VAT = 24
      expect(price).toBe(24);
    });

    it('should calculate original price with VAT correctly', () => {
      // prod-1: 2000 cents = $20, with 20% VAT = 24
      const originalPrice = component.getOriginalPriceWithVat(mockProducts[0]);
      expect(originalPrice).toBe(24);
    });

    it('should apply discount in preview price calculation', () => {
      component.discount = 10; // 10% discount
      // prod-2: 3000 cents = $30
      // After 10% discount: $27
      // With 20% VAT: 27 * 1.2 = 32.4
      const price = component.getPriceWithVat(mockProducts[1]);
      expect(price).toBeCloseTo(32.4, 1);
    });

    it('should detect discount when discount is greater than 0', () => {
      component.discount = 10;
      expect(component.hasDiscount()).toBe(true);
    });

    it('should not detect discount when discount is 0', () => {
      component.discount = 0;
      expect(component.hasDiscount()).toBe(false);
    });

    it('should calculate item subtotal correctly', () => {
      // prod-1 in cart: price = 20, quantity = 5
      const subtotal = component.getItemSubtotalWithVat(mockProducts[0], 5);
      expect(subtotal).toBe(100); // 20 * 5 = 100
    });
  });

  describe('Integration with Child Components', () => {
    it('should pass correct inputs to BulkProductCard', () => {
      fixture.detectChanges();
      const cardElement = fixture.debugElement.nativeElement.querySelector('app-bulk-product-card');
      expect(cardElement).toBeTruthy();
    });

    it('should handle card toggle events from child', () => {
      const compiled = fixture.nativeElement;
      component.onCardToggle('prod-1');
      expect(component.isExpanded('prod-1')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cart items', () => {
      component.cartItems = [];
      expect(component.isInCart('prod-1')).toBe(false);
    });

    it('should handle empty bulk quantities map', () => {
      component.bulkQuantities = new Map();
      expect(component.getBulkQuantity('prod-1')).toBe(0);
    });

    it('should handle null currency', () => {
      component.currency = null;
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should handle product with no image URL', () => {
      const productNoImage = { ...mockProducts[0], imageUrl: undefined };
      spyOn(component.imageClick, 'emit');
      component.onImageClick(productNoImage, '');
      expect(component.imageClick.emit).toHaveBeenCalledWith({
        imageUrl: '',
        altText: 'Product 1'
      });
    });
  });
});
