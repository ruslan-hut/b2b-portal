import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BulkActionsBarComponent } from './bulk-actions-bar.component';
import { CoreModule } from '../../../../core/core.module';
import { FrontendCategory } from '../../../../core/services/product.service';

describe('BulkActionsBarComponent', () => {
  let component: BulkActionsBarComponent;
  let fixture: ComponentFixture<BulkActionsBarComponent>;
  let mockCategories: FrontendCategory[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkActionsBarComponent],
      imports: [CoreModule, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkActionsBarComponent);
    component = fixture.componentInstance;

    mockCategories = [
      { uid: 'cat-1', name: 'Category 1' },
      { uid: 'cat-2', name: 'Category 2' }
    ];

    component.categories = mockCategories;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should debounce search input by 400ms', fakeAsync(() => {
    spyOn(component.search, 'emit');
    fixture.detectChanges();

    component.searchQuery = 'test';
    component.onSearchInput();

    expect(component.search.emit).not.toHaveBeenCalled();

    tick(400);
    expect(component.search.emit).toHaveBeenCalledWith('test');
  }));

  it('should emit search immediately when button clicked', () => {
    spyOn(component.search, 'emit');
    component.searchQuery = 'test';
    component.onSearchClick();
    expect(component.search.emit).toHaveBeenCalledWith('test');
  });

  it('should emit categoryChange when category selected', () => {
    spyOn(component.categoryChange, 'emit');
    component.selectedCategory = 'cat-1';
    component.onCategorySelect();
    expect(component.categoryChange.emit).toHaveBeenCalledWith('cat-1');
  });

  it('should display cart total with currency', () => {
    component.cartTotal = 1234.56;
    component.currencyName = 'USD';
    fixture.detectChanges();

    const cartTotalElement = fixture.nativeElement.querySelector('.cart-total-value');
    expect(cartTotalElement.textContent).toContain('1234.56');
    expect(cartTotalElement.textContent).toContain('USD');
  });
});
