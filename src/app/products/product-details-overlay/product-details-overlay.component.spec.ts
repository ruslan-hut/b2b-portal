import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDetailsOverlayComponent } from './product-details-overlay.component';

describe('ProductDetailsOverlayComponent', () => {
  let component: ProductDetailsOverlayComponent;
  let fixture: ComponentFixture<ProductDetailsOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProductDetailsOverlayComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductDetailsOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
