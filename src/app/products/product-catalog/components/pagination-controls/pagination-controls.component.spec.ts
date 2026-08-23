import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationControlsComponent } from './pagination-controls.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

describe('PaginationControlsComponent', () => {
  let component: PaginationControlsComponent;
  let fixture: ComponentFixture<PaginationControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaginationControlsComponent, IconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaginationControlsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Scroll to Top Button', () => {
    it('should show scroll-to-top when showScrollToTop is true', () => {
      fixture.componentRef.setInput('showScrollToTop', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-scroll-to-top');
      expect(button).toBeTruthy();
    });

    it('should hide scroll-to-top when showScrollToTop is false', () => {
      fixture.componentRef.setInput('showScrollToTop', false);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-scroll-to-top');
      expect(button).toBeFalsy();
    });

    it('should emit scrollToTop when button clicked', () => {
      spyOn(component.scrollToTop, 'emit');
      fixture.componentRef.setInput('showScrollToTop', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.btn-scroll-to-top');
      button.click();

      expect(component.scrollToTop.emit).toHaveBeenCalled();
    });
  });
});
