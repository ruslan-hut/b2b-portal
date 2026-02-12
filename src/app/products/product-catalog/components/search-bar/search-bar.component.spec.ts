import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SearchBarComponent } from './search-bar.component';
import { CoreModule } from '../../../../core/core.module';
import { FrontendCategory } from '../../../../core/services/product.service';

describe('SearchBarComponent', () => {
  let component: SearchBarComponent;
  let fixture: ComponentFixture<SearchBarComponent>;
  let mockCategories: FrontendCategory[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SearchBarComponent],
      imports: [CoreModule, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchBarComponent);
    component = fixture.componentInstance;

    // Setup mock categories
    mockCategories = [
      { uid: 'cat-1', name: 'Category 1' },
      { uid: 'cat-2', name: 'Category 2' },
      { uid: 'cat-3', name: 'Category 3' }
    ];

    component.categories = mockCategories;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Search Debouncing', () => {
    it('should debounce search input by 400ms', fakeAsync(() => {
      spyOn(component.search, 'emit');
      fixture.detectChanges();

      component.searchQuery = 'test';
      component.onSearchInput();

      // Should not emit immediately
      expect(component.search.emit).not.toHaveBeenCalled();

      // Wait 200ms - still should not emit
      tick(200);
      expect(component.search.emit).not.toHaveBeenCalled();

      // Wait another 200ms (total 400ms)
      tick(200);
      expect(component.search.emit).toHaveBeenCalledWith('test');
    }));

    it('should only emit when search query changes', fakeAsync(() => {
      spyOn(component.search, 'emit');
      fixture.detectChanges();

      component.searchQuery = 'test';
      component.onSearchInput();
      tick(400);

      expect(component.search.emit).toHaveBeenCalledWith('test');
      expect(component.search.emit).toHaveBeenCalledTimes(1);

      // Type same query again
      component.searchQuery = 'test';
      component.onSearchInput();
      tick(400);

      // Should not emit again for same value
      expect(component.search.emit).toHaveBeenCalledTimes(1);
    }));

    it('should reset debounce timer on new input', fakeAsync(() => {
      spyOn(component.search, 'emit');
      fixture.detectChanges();

      component.searchQuery = 'test';
      component.onSearchInput();

      tick(300);
      expect(component.search.emit).not.toHaveBeenCalled();

      // Type more before 400ms
      component.searchQuery = 'test2';
      component.onSearchInput();

      tick(300);
      expect(component.search.emit).not.toHaveBeenCalled();

      // Wait full 400ms from last input
      tick(100);
      expect(component.search.emit).toHaveBeenCalledWith('test2');
    }));
  });

  describe('Search Button Click', () => {
    it('should emit search immediately when search button clicked', () => {
      spyOn(component.search, 'emit');
      fixture.detectChanges();

      component.searchQuery = 'test query';
      component.onSearchClick();

      expect(component.search.emit).toHaveBeenCalledWith('test query');
    });

    it('should emit search immediately on Enter key', () => {
      spyOn(component.search, 'emit');
      fixture.detectChanges();

      component.searchQuery = 'test query';
      component.onSearchClick(); // simulates Enter key handler

      expect(component.search.emit).toHaveBeenCalledWith('test query');
    });
  });

  describe('Category Selection', () => {
    it('should emit categoryChange when category selected', () => {
      spyOn(component.categoryChange, 'emit');
      fixture.detectChanges();

      component.selectedCategory = 'cat-1';
      component.onCategorySelect();

      expect(component.categoryChange.emit).toHaveBeenCalledWith('cat-1');
    });

    it('should display all categories in dropdown', () => {
      fixture.detectChanges();

      const options = fixture.nativeElement.querySelectorAll('option');
      // +1 for "All Categories" option
      expect(options.length).toBe(mockCategories.length + 1);
    });

    it('should display category names correctly', () => {
      fixture.detectChanges();

      const options = fixture.nativeElement.querySelectorAll('option');
      expect(options[1].textContent.trim()).toBe('Category 1');
      expect(options[2].textContent.trim()).toBe('Category 2');
      expect(options[3].textContent.trim()).toBe('Category 3');
    });
  });

  describe('Cart Total Display', () => {
    it('should display cart total with currency', () => {
      component.cartTotal = 1234.56;
      component.currencyName = 'USD';
      fixture.detectChanges();

      const cartTotalElement = fixture.nativeElement.querySelector('.cart-total-amount');
      expect(cartTotalElement.textContent).toContain('1234.56');
      expect(cartTotalElement.textContent).toContain('USD');
    });

    it('should display cart total without currency when not provided', () => {
      component.cartTotal = 1234.56;
      component.currencyName = undefined;
      fixture.detectChanges();

      const cartTotalElement = fixture.nativeElement.querySelector('.cart-total-amount');
      expect(cartTotalElement.textContent).toContain('1234.56');
      expect(cartTotalElement.textContent).not.toContain('USD');
    });

    it('should format cart total to 2 decimal places', () => {
      component.cartTotal = 1234.5;
      component.currencyName = 'EUR';
      fixture.detectChanges();

      const cartTotalElement = fixture.nativeElement.querySelector('.cart-total-amount');
      expect(cartTotalElement.textContent).toContain('1234.50');
    });
  });

  describe('Component Lifecycle', () => {
    it('should complete search subject on destroy', () => {
      spyOn(component['searchSubject'], 'complete');
      component.ngOnDestroy();
      expect(component['searchSubject'].complete).toHaveBeenCalled();
    });
  });
});
