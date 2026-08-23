import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { OrderHistoryComponent } from './order-history.component';
import { CatalogExportDialogComponent } from '../catalog-export-dialog/catalog-export-dialog.component';
import { OrderImportDialogComponent } from '../order-import-dialog/order-import-dialog.component';
import { SharedModule } from '../../shared/shared.module';

describe('OrderHistoryComponent', () => {
  let component: OrderHistoryComponent;
  let fixture: ComponentFixture<OrderHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderHistoryComponent, CatalogExportDialogComponent, OrderImportDialogComponent],
      imports: [SharedModule, RouterModule, HttpClientTestingModule],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
