import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { OrderImportDialogComponent, ImportFileRequest } from './order-import-dialog.component';
import { SharedModule } from '../../shared/shared.module';
import { CatalogImportItem, CatalogImportResult } from '../../core/models/catalog-file.model';

describe('OrderImportDialogComponent', () => {
  let component: OrderImportDialogComponent;
  let fixture: ComponentFixture<OrderImportDialogComponent>;

  function item(overrides: Partial<CatalogImportItem> = {}): CatalogImportItem {
    return {
      rowNumber: 2,
      productUid: 'p1',
      sku: 'KK01',
      productName: 'Пензлик',
      quantity: 2,
      requestedQuantity: 2,
      availableQuantity: 10,
      priceWithVat: 21500,
      priceFinal: 15050,
      discountPercent: 30,
      clamped: false,
      ...overrides
    };
  }

  function result(overrides: Partial<CatalogImportResult> = {}): CatalogImportResult {
    return { items: [], skipped: [], rowsWithQuantity: 0, ...overrides };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderImportDialogComponent],
      imports: [SharedModule]
    }).compileComponents();

    fixture = TestBed.createComponent(OrderImportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('column selection', () => {
    const file = new File(['x'], 'order.xlsx');

    function pickFile(): jasmine.Spy {
      const emitted = jasmine.createSpy('fileSelected');
      component.fileSelected.subscribe(emitted);
      component.onDrop({
        preventDefault: () => undefined,
        dataTransfer: { files: [file] }
      } as unknown as DragEvent);
      return emitted;
    }

    it('defaults to the export layout', () => {
      expect(component.skuColumn).toBe(2);
      expect(component.quantityColumn).toBe(4);
      expect(component.columnsAreDefault).toBeTrue();
      expect(component.columnsUsable).toBeTrue();
    });

    it('adopts the remembered columns when they arrive', () => {
      component.columns = { sku: 3, quantity: 1 };
      component.ngOnChanges({ columns: new SimpleChange(null, component.columns, false) });

      expect(component.skuColumn).toBe(3);
      expect(component.quantityColumn).toBe(1);
      expect(component.columnsAreDefault).toBeFalse();
    });

    it('sends the chosen columns along with the file', () => {
      component.skuColumn = 3;
      component.quantityColumn = 1;

      const emitted = pickFile();

      expect(emitted).toHaveBeenCalledTimes(1);
      const request = emitted.calls.mostRecent().args[0] as ImportFileRequest;
      expect(request.file).toBe(file);
      expect(request.columns).toEqual({ sku: 3, quantity: 1 });
    });

    it('rejects a column below one', () => {
      component.skuColumn = 0;
      expect(component.columnsInvalid).toBeTrue();
      expect(component.columnsUsable).toBeFalse();
      expect(pickFile()).not.toHaveBeenCalled();
    });

    it('rejects both settings pointing at the same column', () => {
      component.quantityColumn = 2;
      expect(component.columnsCollide).toBeTrue();
      expect(component.columnsUsable).toBeFalse();
      expect(pickFile()).not.toHaveBeenCalled();
    });

    it('restores the defaults on demand', () => {
      component.skuColumn = 7;
      component.quantityColumn = 8;
      component.resetColumns();

      expect(component.columnsAreDefault).toBeTrue();
    });

    it('does not accept a drop while a file is already being read', () => {
      component.parsing = true;
      expect(pickFile()).not.toHaveBeenCalled();
    });
  });

  it('starts on the file-picking step', () => {
    expect(component.hasResult).toBeFalse();
    expect(component.canApply).toBeFalse();
  });

  it('totals the discounted, VAT-inclusive line prices', () => {
    component.result = result({
      items: [item({ quantity: 2, priceFinal: 15050 }), item({ rowNumber: 3, quantity: 1, priceFinal: 69650 })]
    });

    // 2 × 150.50 + 1 × 696.50 = 997.50
    expect(component.totalCents).toBe(99750);
    expect(component.money(component.totalCents)).toBe('997.50');
  });

  it('counts the lines whose quantity was reduced to stock', () => {
    component.result = result({
      items: [item({ clamped: true }), item({ rowNumber: 3 }), item({ rowNumber: 4, clamped: true })]
    });

    expect(component.clampedCount).toBe(2);
  });

  it('cannot apply a file where nothing matched', () => {
    component.result = result({ skipped: [{ rowNumber: 2, quantity: 1, reason: 'not_found' }] });

    expect(component.hasResult).toBeTrue();
    expect(component.canApply).toBeFalse();
  });

  it('cannot apply while busy', () => {
    component.result = result({ items: [item()] });
    expect(component.canApply).toBeTrue();

    component.applying = true;
    expect(component.canApply).toBeFalse();
  });

  it('forces replace when the cart is empty, whatever the radio says', () => {
    component.result = result({ items: [item()] });
    component.cartItemCount = 0;
    component.applyMode = 'merge';

    const emitted = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(emitted);
    component.onConfirm();

    expect(emitted).toHaveBeenCalledWith('replace');
  });

  it('honours the chosen mode when the cart already has items', () => {
    component.result = result({ items: [item()] });
    component.cartItemCount = 3;
    component.applyMode = 'merge';

    const emitted = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(emitted);
    component.onConfirm();

    expect(emitted).toHaveBeenCalledWith('merge');
  });

  it('maps skip reasons to translation keys', () => {
    expect(component.skipReasonKey('duplicate')).toBe('orders.importSkipDuplicate');
    expect(component.skipReasonKey('no_stock')).toBe('orders.importSkipNoStock');
    expect(component.skipReasonKey('not_found')).toBe('orders.importSkipNotFound');
  });

  it('does not close while a file is being read or applied', () => {
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);

    component.parsing = true;
    component.onClose();
    component.parsing = false;
    component.applying = true;
    component.onClose();

    expect(closed).not.toHaveBeenCalled();

    component.applying = false;
    component.onClose();
    expect(closed).toHaveBeenCalled();
  });
});
