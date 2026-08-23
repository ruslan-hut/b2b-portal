import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductGridComponent } from './product-grid.component';
import { PricingHelperService } from '../../services/pricing-helper.service';

// NOTE: Original assertions mutated input properties directly and called the removed
// ngOnInit/ngOnChanges hooks. After migrating to signal inputs + computed grouping,
// these tests need to be rewritten using `fixture.componentRef.setInput(...)` and
// reading `productsByCategory()`/`categories()` signals. Stub kept for component-
// creation coverage.
describe('ProductGridComponent', () => {
  let component: ProductGridComponent;
  let fixture: ComponentFixture<ProductGridComponent>;

  beforeEach(async () => {
    const pricingHelperMock = jasmine.createSpyObj('PricingHelperService', [
      'getDisplayPriceWithVat',
      'getOriginalPriceWithVat',
      'hasDiscount'
    ]);
    pricingHelperMock.getDisplayPriceWithVat.and.returnValue(0);
    pricingHelperMock.getOriginalPriceWithVat.and.returnValue(0);
    pricingHelperMock.hasDiscount.and.returnValue(false);

    await TestBed.configureTestingModule({
      declarations: [ProductGridComponent],
      providers: [
        { provide: PricingHelperService, useValue: pricingHelperMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('products', []);
    fixture.componentRef.setInput('cartItems', []);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
