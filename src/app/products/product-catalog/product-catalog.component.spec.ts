import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ProductCatalogComponent } from './product-catalog.component';
import { ProductsModule } from '../products.module';

describe('ProductCatalogComponent', () => {
  let component: ProductCatalogComponent;
  let fixture: ComponentFixture<ProductCatalogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // The catalog composes ~10 sibling components; importing the owning
      // module declares them all rather than stubbing each one.
      imports: [ProductsModule, HttpClientTestingModule],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
