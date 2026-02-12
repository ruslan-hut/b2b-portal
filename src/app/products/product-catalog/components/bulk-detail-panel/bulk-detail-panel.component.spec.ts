import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkDetailPanelComponent } from './bulk-detail-panel.component';
import { CoreModule } from '../../../../core/core.module';
import { Product } from '../../../../core/models/product.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

describe('BulkDetailPanelComponent', () => {
  let component: BulkDetailPanelComponent;
  let fixture: ComponentFixture<BulkDetailPanelComponent>;
  let mockProduct: Product;
  let imageCacheService: ProductImageCacheService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkDetailPanelComponent],
      imports: [CoreModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkDetailPanelComponent);
    component = fixture.componentInstance;
    imageCacheService = TestBed.inject(ProductImageCacheService);

    mockProduct = {
      id: 'prod-1',
      sku: 'TEST-001',
      name: 'Test Product',
      description: 'Test product description',
      category: 'Test Category',
      price: 2000,
      inStock: true,
      availableQuantity: 100,
      imageUrl: 'https://example.com/image.jpg',
      isNew: true,
      isHotSale: false,
      discountPercent: 5
    };

    component.product = mockProduct;
    component.priceWithVat = 24.00;
    component.originalPrice = 26.00;
    component.hasDiscount = true;
    component.currencyName = 'USD';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Rendering', () => {
    it('should render detail card when product is provided', () => {
      fixture.detectChanges();
      const detailCard = fixture.nativeElement.querySelector('.detail-card');
      expect(detailCard).toBeTruthy();
    });

    it('should not render when product is null', () => {
      component.product = null;
      fixture.detectChanges();
      const detailCard = fixture.nativeElement.querySelector('.detail-card');
      expect(detailCard).toBeFalsy();
    });
  });

  describe('Product Information Display', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display product name', () => {
      const title = fixture.nativeElement.querySelector('.detail-title');
      expect(title.textContent).toContain('Test Product');
    });

    it('should display product category', () => {
      const category = fixture.nativeElement.querySelector('.detail-category');
      expect(category.textContent).toContain('Test Category');
    });

    it('should display product SKU', () => {
      const sku = fixture.nativeElement.querySelector('.detail-sku');
      expect(sku.textContent).toContain('TEST-001');
    });

    it('should display product image', () => {
      const image = fixture.nativeElement.querySelector('.detail-image img');
      expect(image).toBeTruthy();
    });
  });

  describe('Badges Display', () => {
    it('should display new badge when product is new', () => {
      component.product = { ...mockProduct, isNew: true, isHotSale: false };
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge-new');
      expect(badge).toBeTruthy();
    });

    it('should display hot sale badge when product is on sale', () => {
      component.product = { ...mockProduct, isNew: false, isHotSale: true };
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge-hot-sale');
      expect(badge).toBeTruthy();
    });

    it('should display both badges when applicable', () => {
      component.product = { ...mockProduct, isNew: true, isHotSale: true };
      fixture.detectChanges();
      const newBadge = fixture.nativeElement.querySelector('.badge-new');
      const hotSaleBadge = fixture.nativeElement.querySelector('.badge-hot-sale');
      expect(newBadge).toBeTruthy();
      expect(hotSaleBadge).toBeTruthy();
    });

    it('should not display badges when product is neither new nor on sale', () => {
      component.product = { ...mockProduct, isNew: false, isHotSale: false };
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelector('.product-badges');
      expect(badges).toBeFalsy();
    });
  });

  describe('Price Display', () => {
    it('should display price with VAT', () => {
      component.priceWithVat = 24.00;
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.discounted-price');
      expect(price.textContent).toContain('24.00');
    });

    it('should display original price when discount is applied', () => {
      component.hasDiscount = true;
      component.originalPrice = 26.00;
      fixture.detectChanges();
      const originalPrice = fixture.nativeElement.querySelector('.original-price');
      expect(originalPrice).toBeTruthy();
      expect(originalPrice.textContent).toContain('26.00');
    });

    it('should not display original price when no discount', () => {
      component.hasDiscount = false;
      fixture.detectChanges();
      const originalPrice = fixture.nativeElement.querySelector('.original-price');
      expect(originalPrice).toBeFalsy();
    });

    it('should display currency name', () => {
      component.currencyName = 'USD';
      fixture.detectChanges();
      const currencyLabel = fixture.nativeElement.querySelector('.price-label');
      expect(currencyLabel.textContent).toContain('USD');
    });

    it('should handle empty currency name', () => {
      component.currencyName = undefined;
      fixture.detectChanges();
      const currencyLabel = fixture.nativeElement.querySelector('.price-label');
      expect(currencyLabel.textContent.trim()).toBe('');
    });

    it('should apply has-discount class when discount is active', () => {
      component.hasDiscount = true;
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.discounted-price');
      expect(price.classList.contains('has-discount')).toBe(true);
    });

    it('should show "price not available" when price is 0', () => {
      component.product = { ...mockProduct, price: 0 };
      fixture.detectChanges();
      const detailPrice = fixture.nativeElement.querySelector('.detail-price');
      expect(detailPrice.textContent).toContain('products.priceNotAvailable');
    });
  });

  describe('Stock Status Display', () => {
    it('should show in stock status when product is available', () => {
      component.product = { ...mockProduct, inStock: true };
      fixture.detectChanges();
      const stockIndicator = fixture.nativeElement.querySelector('.stock-indicator');
      expect(stockIndicator.textContent).toContain('products.stock');
    });

    it('should show out of stock status when product is unavailable', () => {
      component.product = { ...mockProduct, inStock: false };
      fixture.detectChanges();
      const stockIndicator = fixture.nativeElement.querySelector('.stock-indicator');
      expect(stockIndicator.textContent).toContain('products.outOfStock');
    });

    it('should display available status dot when in stock', () => {
      component.product = { ...mockProduct, inStock: true };
      fixture.detectChanges();
      const statusDot = fixture.nativeElement.querySelector('.status-dot.available');
      expect(statusDot).toBeTruthy();
    });

    it('should display unavailable status dot when out of stock', () => {
      component.product = { ...mockProduct, inStock: false };
      fixture.detectChanges();
      const statusDot = fixture.nativeElement.querySelector('.status-dot.unavailable');
      expect(statusDot).toBeTruthy();
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
      component.product = { ...mockProduct, imageUrl: undefined };

      const url = component.getProductImageUrl();
      expect(url).toBe('placeholder.svg');
    });

    it('should use placeholder when product is null', () => {
      spyOn(imageCacheService, 'getPlaceholderUrl').and.returnValue('placeholder.svg');
      component.product = null;

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

  describe('Event Emissions', () => {
    it('should emit cardClick when card is clicked', () => {
      spyOn(component.cardClick, 'emit');
      const event = new Event('click');

      component.onCardClick(event);
      expect(component.cardClick.emit).toHaveBeenCalled();
    });

    it('should emit cardClick when detail card element is clicked', () => {
      spyOn(component.cardClick, 'emit');
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.detail-card');
      card.click();
      expect(component.cardClick.emit).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle product with all optional fields missing', () => {
      const minimalProduct: Product = {
        id: 'prod-min',
        sku: '',
        name: 'Minimal Product',
        description: '',
        category: '',
        price: 0,
        inStock: false,
        availableQuantity: 0
      };
      component.product = minimalProduct;
      fixture.detectChanges();

      const detailCard = fixture.nativeElement.querySelector('.detail-card');
      expect(detailCard).toBeTruthy();
    });

    it('should handle zero price gracefully', () => {
      component.product = { ...mockProduct, price: 0 };
      component.priceWithVat = 0;
      fixture.detectChanges();

      const detailPrice = fixture.nativeElement.querySelector('.detail-price');
      expect(detailPrice).toBeTruthy();
    });
  });
});
