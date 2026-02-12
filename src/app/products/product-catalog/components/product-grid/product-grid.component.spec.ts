import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductGridComponent } from './product-grid.component';
import { PricingHelperService } from '../../services/pricing-helper.service';
import { CoreModule } from '../../../../core/core.module';
import { CategoryHeaderComponent } from '../category-header/category-header.component';
import { ProductCardComponent } from '../product-card/product-card.component';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';
import { Currency } from '../../../../core/models/currency.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

describe('ProductGridComponent', () => {
  let component: ProductGridComponent;
  let fixture: ComponentFixture<ProductGridComponent>;
  let mockProducts: Product[];
  let mockCartItems: OrderItem[];
  let mockCurrency: Currency;
  let pricingHelper: PricingHelperService;
  let mockImageCacheService: jasmine.SpyObj<ProductImageCacheService>;

  beforeEach(async () => {
    // Create spy for ProductImageCacheService
    mockImageCacheService = jasmine.createSpyObj('ProductImageCacheService', [
      'hasImageUrl',
      'getImageUrl',
      'getPlaceholderUrl'
    ]);

    await TestBed.configureTestingModule({
      declarations: [
        ProductGridComponent,
        CategoryHeaderComponent,
        ProductCardComponent
      ],
      imports: [CoreModule],
      providers: [
        PricingHelperService,
        { provide: ProductImageCacheService, useValue: mockImageCacheService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductGridComponent);
    component = fixture.componentInstance;
    pricingHelper = TestBed.inject(PricingHelperService);

    // Setup mock products
    mockProducts = [
      {
        id: 'prod-1',
        name: 'Product 1',
        description: 'Description 1',
        price: 100,
        sku: 'SKU-001',
        category: 'Category A',
        inStock: true,
        availableQuantity: 10,
        sortOrder: 1
      },
      {
        id: 'prod-2',
        name: 'Product 2',
        description: 'Description 2',
        price: 200,
        sku: 'SKU-002',
        category: 'Category A',
        inStock: true,
        availableQuantity: 20,
        sortOrder: 2
      },
      {
        id: 'prod-3',
        name: 'Product 3',
        description: 'Description 3',
        price: 150,
        sku: 'SKU-003',
        category: 'Category B',
        inStock: true,
        availableQuantity: 15,
        sortOrder: 3
      }
    ];

    // Setup mock cart items
    mockCartItems = [];

    // Setup mock currency
    mockCurrency = {
      code: 'USD',
      name: 'US Dollar',
      sign: '$',
      rate: 1.0
    };

    // Setup required inputs
    component.products = mockProducts;
    component.cartItems = mockCartItems;
    component.currency = mockCurrency;
    component.discount = 0;
    component.vatRate = 20;

    // Setup mock service responses
    mockImageCacheService.hasImageUrl.and.returnValue(false);
    mockImageCacheService.getPlaceholderUrl.and.returnValue('assets/images/product-placeholder.svg');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Product Grouping', () => {
    it('should group products by category on init', () => {
      fixture.detectChanges();

      expect(component.productsByCategory.size).toBe(2);
      expect(component.productsByCategory.get('Category A')?.length).toBe(2);
      expect(component.productsByCategory.get('Category B')?.length).toBe(1);
    });

    it('should regroup products when products input changes', () => {
      fixture.detectChanges();

      const newProducts = [
        {
          id: 'prod-4',
          name: 'Product 4',
          description: 'Description 4',
          price: 250,
          sku: 'SKU-004',
          category: 'Category C',
          inStock: true,
          availableQuantity: 25,
          sortOrder: 4
        }
      ];

      component.products = newProducts;
      component.ngOnChanges({
        products: {
          currentValue: newProducts,
          previousValue: mockProducts,
          firstChange: false,
          isFirstChange: () => false
        }
      });

      expect(component.productsByCategory.size).toBe(1);
      expect(component.productsByCategory.get('Category C')?.length).toBe(1);
    });

    it('should create sorted list of category names', () => {
      fixture.detectChanges();

      expect(component.categories).toEqual(['Category A', 'Category B']);
    });
  });

  describe('Cart Quantity', () => {
    it('should return 0 when product not in cart', () => {
      const quantity = component.getCartQuantity('prod-1');
      expect(quantity).toBe(0);
    });

    it('should return cart quantity when product in cart', () => {
      component.cartItems = [{
        productId: 'prod-1',
        productName: 'Product 1',
        quantity: 5,
        price: 100,
        subtotal: 500,
        sortOrder: 1
      }];

      const quantity = component.getCartQuantity('prod-1');
      expect(quantity).toBe(5);
    });
  });

  describe('Pricing Calculations', () => {
    it('should get price with VAT from pricing helper', () => {
      spyOn(pricingHelper, 'getDisplayPriceWithVat').and.returnValue(120);

      const price = component.getPriceWithVat(mockProducts[0]);

      expect(price).toBe(120);
      expect(pricingHelper.getDisplayPriceWithVat).toHaveBeenCalledWith(
        mockProducts[0],
        mockCartItems,
        0,
        20
      );
    });

    it('should get original price with VAT from pricing helper', () => {
      spyOn(pricingHelper, 'getOriginalPriceWithVat').and.returnValue(120);

      const price = component.getOriginalPriceWithVat(mockProducts[0]);

      expect(price).toBe(120);
      expect(pricingHelper.getOriginalPriceWithVat).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should check if discount is active', () => {
      component.discount = 10;
      spyOn(pricingHelper, 'hasDiscount').and.returnValue(true);

      const hasDiscount = component.hasDiscount();

      expect(hasDiscount).toBe(true);
      expect(pricingHelper.hasDiscount).toHaveBeenCalledWith(10);
    });
  });

  describe('Event Emissions', () => {
    it('should emit addToCart with product when onAddToCart called', () => {
      spyOn(component.addToCart, 'emit');

      component.onAddToCart(mockProducts[0]);

      expect(component.addToCart.emit).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should emit imagePreview with url and alt when onImageClick called', () => {
      spyOn(component.imagePreview, 'emit');
      const product = mockProducts[0];

      component.onImageClick(product);

      expect(component.imagePreview.emit).toHaveBeenCalledWith({
        url: 'assets/images/product-placeholder.svg',
        alt: product.name
      });
    });

    it('should emit imagePreview with product imageUrl when available', () => {
      spyOn(component.imagePreview, 'emit');
      const product = { ...mockProducts[0], imageUrl: 'product-image.jpg' };

      component.onImageClick(product);

      expect(component.imagePreview.emit).toHaveBeenCalledWith({
        url: 'product-image.jpg',
        alt: product.name
      });
    });

    it('should emit productDetails with product when onCardClick called', () => {
      spyOn(component.productDetails, 'emit');

      component.onCardClick(mockProducts[0]);

      expect(component.productDetails.emit).toHaveBeenCalledWith(mockProducts[0]);
    });
  });

  describe('Template Integration', () => {
    it('should render category headers for each category', () => {
      fixture.detectChanges();

      const categoryHeaders = fixture.nativeElement.querySelectorAll('app-category-header');
      expect(categoryHeaders.length).toBe(2);
    });

    it('should render product cards for all products', () => {
      fixture.detectChanges();

      const productCards = fixture.nativeElement.querySelectorAll('app-product-card');
      expect(productCards.length).toBe(3);
    });

    it('should show empty state when no products', () => {
      component.products = [];
      component.ngOnInit();
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
});
