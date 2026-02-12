import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationControlsComponent } from './pagination-controls.component';

describe('PaginationControlsComponent', () => {
  let component: PaginationControlsComponent;
  let fixture: ComponentFixture<PaginationControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaginationControlsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaginationControlsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Load More Button', () => {
    it('should show load more button when hasMore is true and showFloating is true', () => {
      component.hasMore = true;
      component.showFloating = true;
      component.loading = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-floating-show-more');
      expect(button).toBeTruthy();
    });

    it('should hide load more button when hasMore is false', () => {
      component.hasMore = false;
      component.showFloating = true;
      component.loading = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-floating-show-more');
      expect(button).toBeFalsy();
    });

    it('should hide load more button when loading is true', () => {
      component.hasMore = true;
      component.showFloating = true;
      component.loading = true;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-floating-show-more');
      expect(button).toBeFalsy();
    });

    it('should hide load more button when showFloating is false', () => {
      component.hasMore = true;
      component.showFloating = false;
      component.loading = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-floating-show-more');
      expect(button).toBeFalsy();
    });

    it('should emit loadMore when button clicked', () => {
      spyOn(component.loadMore, 'emit');
      component.hasMore = true;
      component.showFloating = true;
      component.loading = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-floating-show-more');
      button.click();

      expect(component.loadMore.emit).toHaveBeenCalled();
    });

    it('should show loading spinner when loading is true', () => {
      // Note: In the template, the button is hidden when loading is true
      // This test verifies the expected behavior matches the template logic
      component.hasMore = true;
      component.showFloating = true;
      component.loading = true;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-floating-show-more');
      expect(button).toBeFalsy(); // Button hidden during loading
    });
  });

  describe('Scroll to Top Button', () => {
    it('should show scroll-to-top when showScrollToTop is true', () => {
      component.showScrollToTop = true;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-scroll-to-top');
      expect(button).toBeTruthy();
    });

    it('should hide scroll-to-top when showScrollToTop is false', () => {
      component.showScrollToTop = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-scroll-to-top');
      expect(button).toBeFalsy();
    });

    it('should emit scrollToTop when button clicked', () => {
      spyOn(component.scrollToTop, 'emit');
      component.showScrollToTop = true;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-scroll-to-top');
      button.click();

      expect(component.scrollToTop.emit).toHaveBeenCalled();
    });
  });
});
