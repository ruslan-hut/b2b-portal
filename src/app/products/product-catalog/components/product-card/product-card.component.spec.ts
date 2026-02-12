import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';
import { CoreModule } from '../../../../core/core.module';
import { Product } from '../../../../core/models/product.model';

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;
  let mockImageCacheService: jasmine.SpyObj<ProductImageCacheService>;
  let mockProduct: Product;

  beforeEach(async () => {
    // Create spy for ProductImageCacheService
    mockImageCacheService = jasmine.createSpyObj('ProductImageCacheService', [
      'hasImageUrl',
      'getImageUrl',
      'getPlaceholderUrl'
    ]);

    await TestBed.configureTestingModule({
      declarations: [ProductCardComponent],
      imports: [CoreModule],
      providers: [
        { provide: ProductImageCacheService, useValue: mockImageCacheService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;

    // Setup mock product
    mockProduct = {
      id: 'prod-1',
      name: 'Test Product',
      description: 'Test Description',
      price: 100,
      sku: 'SKU-001',
      category: 'Test Category',
      inStock: true,
      availableQuantity: 10,
      sortOrder: 1,
      isNew: false,
      isHotSale: false
    };

    // Setup required inputs
    component.product = mockProduct;
    component.priceWithVat = 120;
    component.originalPrice = 120;

    // Setup mock service responses
    mockImageCacheService.hasImageUrl.and.returnValue(false);
    mockImageCacheService.getPlaceholderUrl.and.returnValue('assets/images/product-placeholder.svg');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Product Information Display', () => {
    it('should display product name', () => {
      fixture.detectChanges();
      const nameElement = fixture.nativeElement.querySelector('.product-name');
      expect(nameElement.textContent).toContain('Test Product');
    });

    it('should display product SKU', () => {
      fixture.detectChanges();
      const skuElement = fixture.nativeElement.querySelector('.product-sku');
      expect(skuElement.textContent).toContain('SKU-001');
    });

    it('should display product category', () => {
      fixture.detectChanges();
      const categoryElement = fixture.nativeElement.querySelector('.product-category');
      expect(categoryElement.textContent).toContain('Test Category');
    });
  });

  describe('Badges', () => {
    it('should show NEW badge when product is new', () => {
      component.product.isNew = true;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge-new');
      expect(badge).toBeTruthy();
    });

    it('should show HOT SALE badge when product is hot sale', () => {
      component.product.isHotSale = true;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge-hot-sale');
      expect(badge).toBeTruthy();
    });

    it('should show cart quantity badge when cartQuantity > 0', () => {
      component.cartQuantity = 5;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.quantity-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('5');
    });

    it('should not show cart quantity badge when cartQuantity is 0', () => {
      component.cartQuantity = 0;
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.quantity-badge');
      expect(badge).toBeFalsy();
    });
  });

  describe('Pricing Display', () => {
    it('should display price with VAT', () => {
      component.priceWithVat = 120.50;
      fixture.detectChanges();
      const priceElement = fixture.nativeElement.querySelector('.price-amount');
      expect(priceElement.textContent.trim()).toContain('120.50');
    });

    it('should show original price with strikethrough when hasDiscount is true', () => {
      component.hasDiscount = true;
      component.originalPrice = 150;
      component.priceWithVat = 120;
      fixture.detectChanges();

      const originalPrice = fixture.nativeElement.querySelector('.original-price .strikethrough');
      expect(originalPrice).toBeTruthy();
      expect(originalPrice.textContent).toContain('150.00');
    });

    it('should not show original price when hasDiscount is false', () => {
      component.hasDiscount = false;
      fixture.detectChanges();

      const originalPrice = fixture.nativeElement.querySelector('.original-price');
      expect(originalPrice).toBeFalsy();
    });

    it('should show discount tag when product has discountPercent', () => {
      component.product.discountPercent = 25;
      fixture.detectChanges();

      const discountTag = fixture.nativeElement.querySelector('.discount-tag');
      expect(discountTag).toBeTruthy();
      expect(discountTag.textContent).toContain('25%');
    });
  });

  describe('Add to Cart Button', () => {
    it('should emit addToCart when button clicked', () => {
      spyOn(component.addToCart, 'emit');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-add-to-cart');
      button.click();

      expect(component.addToCart.emit).toHaveBeenCalled();
    });

    it('should be disabled when product is out of stock', () => {
      component.product.inStock = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-add-to-cart');
      expect(button.disabled).toBe(true);
    });

    it('should be enabled when product is in stock', () => {
      component.product.inStock = true;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-add-to-cart');
      expect(button.disabled).toBe(false);
    });

    it('should stop event propagation when clicked', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');
      component.onAddToCartClick(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Image Handling', () => {
    it('should emit imageClick when image clicked', () => {
      spyOn(component.imageClick, 'emit');
      fixture.detectChanges();

      const imageContainer = fixture.nativeElement.querySelector('.product-image');
      imageContainer.click();

      expect(component.imageClick.emit).toHaveBeenCalled();
    });

    it('should get image URL from cache service when available', () => {
      mockImageCacheService.hasImageUrl.and.returnValue(true);
      mockImageCacheService.getImageUrl.and.returnValue('cached-image-url');

      const url = component.getProductImageUrl();

      expect(url).toBe('cached-image-url');
      expect(mockImageCacheService.hasImageUrl).toHaveBeenCalledWith('prod-1');
      expect(mockImageCacheService.getImageUrl).toHaveBeenCalledWith('prod-1');
    });

    it('should use product imageUrl when cache not available', () => {
      mockImageCacheService.hasImageUrl.and.returnValue(false);
      component.product.imageUrl = 'product-image-url.jpg';

      const url = component.getProductImageUrl();

      expect(url).toBe('product-image-url.jpg');
    });

    it('should use placeholder when no image available', () => {
      mockImageCacheService.hasImageUrl.and.returnValue(false);
      component.product.imageUrl = undefined;
      mockImageCacheService.getPlaceholderUrl.and.returnValue('placeholder.svg');

      const url = component.getProductImageUrl();

      expect(url).toBe('placeholder.svg');
    });

    it('should handle image error with placeholder', () => {
      const imgElement = document.createElement('img');
      const event = { target: imgElement } as any;

      component.onImageError(event);

      expect(imgElement.src).toContain('product-placeholder.svg');
    });
  });

  describe('Card Click', () => {
    it('should emit cardClick when card clicked', () => {
      spyOn(component.cardClick, 'emit');
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.product-card');
      card.click();

      expect(component.cardClick.emit).toHaveBeenCalled();
    });
  });
});
