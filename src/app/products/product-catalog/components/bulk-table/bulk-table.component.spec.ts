import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkTableComponent } from './bulk-table.component';
import { CoreModule } from '../../../../core/core.module';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';

describe('BulkTableComponent', () => {
  let component: BulkTableComponent;
  let fixture: ComponentFixture<BulkTableComponent>;
  let mockProducts: Product[];
  let mockCartItems: OrderItem[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkTableComponent],
      imports: [CoreModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkTableComponent);
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
        isNew: true,
        isHotSale: false,
        discountPercent: 5
      },
      {
        id: 'prod-2',
        sku: 'TEST-002',
        name: 'Product 2',
        description: 'Description for Product 2',
        category: 'Category B',
        price: 3000,
        inStock: false,
        availableQuantity: 0,
        imageUrl: 'image2.jpg',
        isNew: false,
        isHotSale: true,
        discountPercent: 0
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

    component.products = mockProducts;
    component.cartItems = mockCartItems;
    component.discount = 10;
    component.vatRate = 20;
    component.bulkQuantities = new Map([['prod-1', 5], ['prod-2', 0]]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Table Rendering', () => {
    it('should render table when products exist', () => {
      fixture.detectChanges();
      const table = fixture.nativeElement.querySelector('.bulk-table');
      expect(table).toBeTruthy();
    });

    it('should render correct number of rows', () => {
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('.bulk-row');
      expect(rows.length).toBe(2);
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

  describe('Table Headers', () => {
    it('should display standard column headers', () => {
      fixture.detectChanges();
      const headers = fixture.nativeElement.querySelectorAll('thead th');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should show discount column when discount is applied', () => {
      component.discount = 10;
      fixture.detectChanges();
      const discountHeader = fixture.nativeElement.querySelector('.discount-header');
      expect(discountHeader).toBeTruthy();
    });

    it('should not show discount column when no discount', () => {
      component.discount = 0;
      fixture.detectChanges();
      const discountHeader = fixture.nativeElement.querySelector('.discount-header');
      expect(discountHeader).toBeFalsy();
    });
  });

  describe('Product Information Display', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display product SKU', () => {
      const skuCell = fixture.nativeElement.querySelector('.sku-cell');
      expect(skuCell.textContent).toContain('TEST-001');
    });

    it('should display product name', () => {
      const nameCell = fixture.nativeElement.querySelector('.name-cell');
      expect(nameCell.textContent).toContain('Product 1');
    });

    it('should display product category', () => {
      const categoryCell = fixture.nativeElement.querySelector('.category-cell');
      expect(categoryCell.textContent).toContain('Category A');
    });

    it('should display new badge when product is new', () => {
      const badge = fixture.nativeElement.querySelector('.badge-new');
      expect(badge).toBeTruthy();
    });

    it('should display hot sale badge when product is on sale', () => {
      const rows = fixture.nativeElement.querySelectorAll('.bulk-row');
      const secondRow = rows[1];
      const badge = secondRow.querySelector('.badge-hot-sale');
      expect(badge).toBeTruthy();
    });
  });

  describe('Price Display', () => {
    it('should use authoritative price from cart item', () => {
      // prod-1 is in cart with subtotal 100 and quantity 5
      const price = component.getPriceWithVat(mockProducts[0]);
      expect(price).toBe(20); // 100 / 5 = 20
    });

    it('should use preview price for items not in cart', () => {
      // prod-2: 3000 cents = $30
      // With 10% discount: $27
      // With 20% VAT: 27 * 1.2 = 32.4
      const price = component.getPriceWithVat(mockProducts[1]);
      expect(price).toBeCloseTo(32.4, 1);
    });

    it('should calculate original price with VAT', () => {
      // prod-1: 2000 cents = $20, with 20% VAT = 24
      const originalPrice = component.getOriginalPriceWithVat(mockProducts[0]);
      expect(originalPrice).toBe(24);
    });

    it('should show original price when discount is applied', () => {
      component.discount = 10;
      fixture.detectChanges();
      const originalPrice = fixture.nativeElement.querySelector('.original-price');
      expect(originalPrice).toBeTruthy();
    });

    it('should not show original price when no discount', () => {
      component.discount = 0;
      fixture.detectChanges();
      const originalPrice = fixture.nativeElement.querySelector('.original-price');
      expect(originalPrice).toBeFalsy();
    });

    it('should display product-specific discount percentage', () => {
      fixture.detectChanges();
      const discountValue = fixture.nativeElement.querySelector('.discount-value');
      expect(discountValue.textContent).toContain('5%');
    });
  });

  describe('Stock Display', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display available quantity', () => {
      const stockCell = fixture.nativeElement.querySelector('.stock-cell');
      expect(stockCell.textContent).toContain('100');
    });

    it('should apply out-of-stock style when product unavailable', () => {
      const rows = fixture.nativeElement.querySelectorAll('.bulk-row');
      const outOfStockRow = rows[1];
      expect(outOfStockRow.classList.contains('out-of-stock')).toBe(true);
    });
  });

  describe('Quantity Input', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display quantity input for each product', () => {
      const inputs = fixture.nativeElement.querySelectorAll('.quantity-input');
      expect(inputs.length).toBe(2);
    });

    it('should display current bulk quantity in input', () => {
      const input = fixture.nativeElement.querySelector('.quantity-input');
      expect(input.value).toBe('5');
    });

    it('should disable quantity input when product is out of stock', () => {
      const inputs = fixture.nativeElement.querySelectorAll('.quantity-input');
      const outOfStockInput = inputs[1];
      expect(outOfStockInput.disabled).toBe(true);
    });

    it('should not disable quantity input when product is in stock', () => {
      const input = fixture.nativeElement.querySelector('.quantity-input');
      expect(input.disabled).toBe(false);
    });

    it('should show cart badge when product is in cart', () => {
      const cartBadge = fixture.nativeElement.querySelector('.cart-badge');
      expect(cartBadge).toBeTruthy();
    });
  });

  describe('Subtotal Display', () => {
    it('should calculate and display subtotal correctly', () => {
      // prod-1: price = 20, quantity = 5, subtotal = 100
      const subtotal = component.getItemSubtotalWithVat(mockProducts[0], 5);
      expect(subtotal).toBe(100);
    });

    it('should display subtotal when quantity is greater than 0', () => {
      fixture.detectChanges();
      const subtotalCells = fixture.nativeElement.querySelectorAll('.subtotal-cell');
      const firstSubtotal = subtotalCells[0];
      expect(firstSubtotal.textContent).toContain('100');
    });

    it('should display dash when quantity is 0', () => {
      fixture.detectChanges();
      const subtotalCells = fixture.nativeElement.querySelectorAll('.subtotal-cell');
      const secondSubtotal = subtotalCells[1];
      expect(secondSubtotal.textContent.trim()).toBe('-');
    });
  });

  describe('Row States', () => {
    it('should apply selected class to selected product row', () => {
      component.selectedProduct = mockProducts[0];
      fixture.detectChanges();
      const selectedRow = fixture.nativeElement.querySelector('.bulk-row.selected');
      expect(selectedRow).toBeTruthy();
    });

    it('should apply in-cart class to cart items', () => {
      fixture.detectChanges();
      const inCartRow = fixture.nativeElement.querySelector('.bulk-row.in-cart');
      expect(inCartRow).toBeTruthy();
    });
  });

  describe('Event Emissions', () => {
    it('should emit productSelect on row mouseenter', () => {
      spyOn(component.productSelect, 'emit');
      component.onProductSelect(mockProducts[0]);
      expect(component.productSelect.emit).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should emit productSelect on row click', () => {
      spyOn(component.productSelect, 'emit');
      fixture.detectChanges();
      const row = fixture.nativeElement.querySelector('.bulk-row');
      row.click();
      expect(component.productSelect.emit).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should emit quantityChange when input changes', () => {
      spyOn(component.quantityChange, 'emit');
      component.onQuantityChange(mockProducts[0], 10);
      expect(component.quantityChange.emit).toHaveBeenCalledWith({
        product: mockProducts[0],
        quantity: 10
      });
    });

    it('should emit productSelect when quantity input is focused', () => {
      spyOn(component.productSelect, 'emit');
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.quantity-input');
      input.focus();
      expect(component.productSelect.emit).toHaveBeenCalledWith(mockProducts[0]);
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

  describe('Discount Detection', () => {
    it('should detect discount when discount is greater than 0', () => {
      component.discount = 10;
      expect(component.hasDiscount()).toBe(true);
    });

    it('should not detect discount when discount is 0', () => {
      component.discount = 0;
      expect(component.hasDiscount()).toBe(false);
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

    it('should handle null selected product', () => {
      component.selectedProduct = null;
      fixture.detectChanges();
      const selectedRow = fixture.nativeElement.querySelector('.bulk-row.selected');
      expect(selectedRow).toBeFalsy();
    });

    it('should handle quantity mismatch scenario', () => {
      // Simulate user changed quantity to 10 but cart still shows 5
      component.bulkQuantities.set('prod-1', 10);
      // Should fall back to preview calculation
      const price = component.getPriceWithVat(mockProducts[0]);
      // 2000 cents = $20, with 10% discount = $18, with 20% VAT = 21.6
      expect(price).toBeCloseTo(21.6, 1);
    });
  });
});
