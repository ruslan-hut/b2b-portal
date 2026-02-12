import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkProductCardComponent } from './bulk-product-card.component';
import { CoreModule } from '../../../../core/core.module';
import { Product } from '../../../../core/models/product.model';
import { Currency } from '../../../../core/models/currency.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

describe('BulkProductCardComponent', () => {
  let component: BulkProductCardComponent;
  let fixture: ComponentFixture<BulkProductCardComponent>;
  let mockProduct: Product;
  let mockCurrency: Currency;
  let imageCacheService: ProductImageCacheService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkProductCardComponent],
      imports: [CoreModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkProductCardComponent);
    component = fixture.componentInstance;
    imageCacheService = TestBed.inject(ProductImageCacheService);

    mockProduct = {
      id: 'prod-1',
      sku: 'TEST-001',
      name: 'Test Product',
      description: 'Test product description',
      category: 'Test Category',
      price: 1999,
      inStock: true,
      availableQuantity: 100,
      imageUrl: 'https://example.com/image.jpg',
      isNew: false,
      isHotSale: false,
      discountPercent: 0
    };

    mockCurrency = {
      code: 'USD',
      name: 'US Dollar',
      sign: '$',
      rate: 1
    };

    component.product = mockProduct;
    component.priceWithVat = 23.88;
    component.originalPrice = 23.88;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Product Information Display', () => {
    it('should display product SKU', () => {
      fixture.detectChanges();
      const skuElement = fixture.nativeElement.querySelector('.card-sku');
      expect(skuElement.textContent).toContain('TEST-001');
    });

    it('should display product name', () => {
      fixture.detectChanges();
      const nameElement = fixture.nativeElement.querySelector('.card-name');
      expect(nameElement.textContent).toContain('Test Product');
    });

    it('should display product category', () => {
      fixture.detectChanges();
      const categoryElement = fixture.nativeElement.querySelector('.card-category');
      expect(categoryElement.textContent).toContain('Test Category');
    });

    it('should display "new" badge when product is new', () => {
      component.product.isNew = true;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge-new');
      expect(badge).toBeTruthy();
    });

    it('should display "hot sale" badge when product is on sale', () => {
      component.product.isHotSale = true;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge-hot-sale');
      expect(badge).toBeTruthy();
    });

    it('should not display badges when product is neither new nor on sale', () => {
      component.product.isNew = false;
      component.product.isHotSale = false;
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelector('.product-badges');
      expect(badges).toBeFalsy();
    });
  });

  describe('Price Display', () => {
    it('should display price with VAT', () => {
      component.priceWithVat = 23.88;
      fixture.detectChanges();
      const priceElement = fixture.nativeElement.querySelector('.card-price');
      expect(priceElement.textContent).toContain('23.88');
    });

    it('should display original price when discount is applied', () => {
      component.hasDiscount = true;
      component.originalPrice = 29.99;
      component.priceWithVat = 23.88;
      fixture.detectChanges();
      const originalPriceElement = fixture.nativeElement.querySelector('.original-price');
      expect(originalPriceElement).toBeTruthy();
      expect(originalPriceElement.textContent).toContain('29.99');
    });

    it('should not display original price when no discount', () => {
      component.hasDiscount = false;
      fixture.detectChanges();
      const originalPriceElement = fixture.nativeElement.querySelector('.original-price');
      expect(originalPriceElement).toBeFalsy();
    });

    it('should display discount percentage when available', () => {
      component.product.discountPercent = 20;
      fixture.detectChanges();
      const discountTag = fixture.nativeElement.querySelector('.discount-tag-mobile');
      expect(discountTag).toBeTruthy();
      expect(discountTag.textContent).toContain('20%');
    });

    it('should apply has-discount class to price when discount is active', () => {
      component.hasDiscount = true;
      fixture.detectChanges();
      const priceElement = fixture.nativeElement.querySelector('.card-price');
      expect(priceElement.classList.contains('has-discount')).toBe(true);
    });
  });

  describe('Stock Status', () => {
    it('should show available status when product is in stock', () => {
      component.product.inStock = true;
      fixture.detectChanges();
      const statusDot = fixture.nativeElement.querySelector('.status-dot.available');
      expect(statusDot).toBeTruthy();
    });

    it('should show unavailable status when product is out of stock', () => {
      component.product.inStock = false;
      fixture.detectChanges();
      const statusDot = fixture.nativeElement.querySelector('.status-dot.unavailable');
      expect(statusDot).toBeTruthy();
    });

    it('should apply out-of-stock class when product is unavailable', () => {
      component.product.inStock = false;
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.bulk-product-card');
      expect(card.classList.contains('out-of-stock')).toBe(true);
    });
  });

  describe('Card State', () => {
    it('should apply expanded class when isExpanded is true', () => {
      component.isExpanded = true;
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.bulk-product-card');
      expect(card.classList.contains('expanded')).toBe(true);
    });

    it('should apply in-cart class when isInCart is true', () => {
      component.isInCart = true;
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.bulk-product-card');
      expect(card.classList.contains('in-cart')).toBe(true);
    });

    it('should show card content when expanded', () => {
      component.isExpanded = true;
      fixture.detectChanges();
      const cardContent = fixture.nativeElement.querySelector('.card-content');
      expect(cardContent).toBeTruthy();
    });

    it('should hide card content when not expanded', () => {
      component.isExpanded = false;
      fixture.detectChanges();
      const cardContent = fixture.nativeElement.querySelector('.card-content');
      expect(cardContent).toBeFalsy();
    });
  });

  describe('Bulk Quantity Display', () => {
    it('should display quantity badge when bulk quantity is greater than 0', () => {
      component.bulkQuantity = 5;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.card-quantity-badge');
      expect(badge).toBeTruthy();
    });

    it('should display correct quantity in badge', () => {
      component.bulkQuantity = 10;
      fixture.detectChanges();
      const badgeText = fixture.nativeElement.querySelector('.quantity-badge-text');
      expect(badgeText.textContent).toContain('10');
    });

    it('should not display quantity badge when bulk quantity is 0', () => {
      component.bulkQuantity = 0;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.card-quantity-badge .quantity-badge-text');
      expect(badge).toBeFalsy();
    });
  });

  describe('Event Emissions', () => {
    it('should emit cardToggle when card header is clicked', () => {
      spyOn(component.cardToggle, 'emit');
      component.onCardClick();
      expect(component.cardToggle.emit).toHaveBeenCalled();
    });

    it('should emit productSelect when card is clicked', () => {
      spyOn(component.productSelect, 'emit');
      component.onCardClick();
      expect(component.productSelect.emit).toHaveBeenCalled();
    });

    it('should emit quantityIncrement when increment button clicked', () => {
      spyOn(component.quantityIncrement, 'emit');
      const event = new Event('click');
      spyOn(event, 'stopPropagation');
      component.onIncrement(event);
      expect(component.quantityIncrement.emit).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should emit quantityDecrement when decrement button clicked', () => {
      spyOn(component.quantityDecrement, 'emit');
      const event = new Event('click');
      spyOn(event, 'stopPropagation');
      component.onDecrement(event);
      expect(component.quantityDecrement.emit).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should emit quantityChange with correct value on input', () => {
      spyOn(component.quantityChange, 'emit');
      const event = { target: { value: '15' }, stopPropagation: jasmine.createSpy() } as any;
      component.onQuantityInput(event);
      expect(component.quantityChange.emit).toHaveBeenCalledWith(15);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should emit imageClick when image is clicked', () => {
      spyOn(component.imageClick, 'emit');
      const event = new Event('click');
      spyOn(event, 'stopPropagation');
      component.onImageClick(event);
      expect(component.imageClick.emit).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Expanded Content', () => {
    beforeEach(() => {
      component.isExpanded = true;
      fixture.detectChanges();
    });

    it('should display product image', () => {
      const image = fixture.nativeElement.querySelector('.card-product-image');
      expect(image).toBeTruthy();
    });

    it('should display quantity controls', () => {
      const controls = fixture.nativeElement.querySelector('.quantity-controls');
      expect(controls).toBeTruthy();
    });

    it('should display increment button', () => {
      const incrementBtn = fixture.nativeElement.querySelector('.btn-increment');
      expect(incrementBtn).toBeTruthy();
    });

    it('should display decrement button', () => {
      const decrementBtn = fixture.nativeElement.querySelector('.btn-decrement');
      expect(decrementBtn).toBeTruthy();
    });

    it('should display quantity input', () => {
      const input = fixture.nativeElement.querySelector('.quantity-input-card');
      expect(input).toBeTruthy();
    });

    it('should disable decrement button when quantity is 0', () => {
      component.bulkQuantity = 0;
      fixture.detectChanges();
      const decrementBtn = fixture.nativeElement.querySelector('.btn-decrement');
      expect(decrementBtn.disabled).toBe(true);
    });

    it('should disable increment button when out of stock', () => {
      component.product.inStock = false;
      fixture.detectChanges();
      const incrementBtn = fixture.nativeElement.querySelector('.btn-increment');
      expect(incrementBtn.disabled).toBe(true);
    });

    it('should disable increment button when quantity equals available quantity', () => {
      component.product.availableQuantity = 10;
      component.bulkQuantity = 10;
      fixture.detectChanges();
      const incrementBtn = fixture.nativeElement.querySelector('.btn-increment');
      expect(incrementBtn.disabled).toBe(true);
    });

    it('should display subtotal when bulk quantity is greater than 0', () => {
      component.bulkQuantity = 5;
      component.subtotalWithVat = 119.40;
      fixture.detectChanges();
      const subtotal = fixture.nativeElement.querySelector('.card-subtotal');
      expect(subtotal).toBeTruthy();
    });

    it('should not display subtotal when bulk quantity is 0', () => {
      component.bulkQuantity = 0;
      fixture.detectChanges();
      const subtotal = fixture.nativeElement.querySelector('.card-subtotal');
      expect(subtotal).toBeFalsy();
    });
  });

  describe('Image Handling', () => {
    it('should get image URL from cache if available', () => {
      spyOn(imageCacheService, 'hasImageUrl').and.returnValue(true);
      spyOn(imageCacheService, 'getImageUrl').and.returnValue('cached-url.jpg');

      const url = component.getProductImageUrl();
      expect(url).toBe('cached-url.jpg');
      expect(imageCacheService.hasImageUrl).toHaveBeenCalledWith('prod-1');
      expect(imageCacheService.getImageUrl).toHaveBeenCalledWith('prod-1');
    });

    it('should use product imageUrl if not in cache', () => {
      spyOn(imageCacheService, 'hasImageUrl').and.returnValue(false);

      const url = component.getProductImageUrl();
      expect(url).toBe('https://example.com/image.jpg');
    });

    it('should use placeholder if no image URL available', () => {
      spyOn(imageCacheService, 'hasImageUrl').and.returnValue(false);
      spyOn(imageCacheService, 'getPlaceholderUrl').and.returnValue('placeholder.svg');
      component.product.imageUrl = undefined;

      const url = component.getProductImageUrl();
      expect(url).toBe('placeholder.svg');
    });

    it('should set placeholder image on error', () => {
      const mockImg = { src: '' } as HTMLImageElement;
      const event = { target: mockImg } as unknown as Event;

      component.onImageError(event);
      expect(mockImg.src).toBe('assets/images/product-placeholder.svg');
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation for quantity input clicks', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.stopPropagation(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });
});
