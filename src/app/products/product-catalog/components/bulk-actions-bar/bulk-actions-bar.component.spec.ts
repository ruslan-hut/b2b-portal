import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BulkActionsBarComponent } from './bulk-actions-bar.component';
import { CoreModule } from '../../../../core/core.module';
import { SharedModule } from '../../../../shared/shared.module';
import { FrontendCategory } from '../../../../core/services/product.service';

describe('BulkActionsBarComponent', () => {
  let component: BulkActionsBarComponent;
  let fixture: ComponentFixture<BulkActionsBarComponent>;
  let mockCategories: FrontendCategory[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkActionsBarComponent],
      imports: [CoreModule, SharedModule, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkActionsBarComponent);
    component = fixture.componentInstance;

    mockCategories = [
      { uid: 'cat-1', name: 'Category 1' },
      { uid: 'cat-2', name: 'Category 2' }
    ];

    fixture.componentRef.setInput('categories', mockCategories);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit search immediately when button clicked', () => {
    spyOn(component.search, 'emit');
    component.searchQuery.set('test');
    component.onSearchClick();
    expect(component.search.emit).toHaveBeenCalledWith('test');
  });

  it('should emit categoryChange when category selected', () => {
    spyOn(component.categoryChange, 'emit');
    component.selectedCategory.set('cat-1');
    component.onCategorySelect();
    expect(component.categoryChange.emit).toHaveBeenCalledWith('cat-1');
  });

  it('should display cart total with currency', () => {
    fixture.componentRef.setInput('cartTotal', 1234.56);
    fixture.componentRef.setInput('currencyName', 'USD');
    fixture.detectChanges();

    const cartTotalElement = fixture.nativeElement.querySelector('.cart-total-value');
    expect(cartTotalElement.textContent).toContain('1234.56');
    expect(cartTotalElement.textContent).toContain('USD');
  });
});
