import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { CatalogExportDialogComponent } from './catalog-export-dialog.component';
import { SharedModule } from '../../shared/shared.module';
import { FrontendCategory } from '../../core/services/product.service';

describe('CatalogExportDialogComponent', () => {
  let component: CatalogExportDialogComponent;
  let fixture: ComponentFixture<CatalogExportDialogComponent>;

  const categories: FrontendCategory[] = [
    { uid: 'c1', name: 'Пензлики' },
    { uid: 'c2', name: 'Фрези' },
    { uid: 'c3', name: 'Гель-лаки' }
  ];

  /** Mirrors what Angular does when the parent's async category load lands. */
  function setCategories(next: FrontendCategory[]): void {
    component.categories = next;
    component.ngOnChanges({ categories: new SimpleChange([], next, false) });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CatalogExportDialogComponent],
      imports: [SharedModule]
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows categories that arrive after the dialog opened', () => {
    expect(component.visibleCategories).toEqual([]);
    setCategories(categories);
    expect(component.visibleCategories).toEqual(categories);
  });

  it('filters the list by name, case-insensitively', () => {
    setCategories(categories);

    component.categoryFilter = 'фре';
    component.onFilterChange();

    expect(component.visibleCategories.map(c => c.uid)).toEqual(['c2']);
  });

  it('defaults to exporting everything', () => {
    setCategories(categories);
    expect(component.exportsEverything).toBeTrue();
    expect(component.selectedCount).toBe(0);
  });

  it('toggles individual categories', () => {
    setCategories(categories);

    component.toggleCategory('c2');
    expect(component.isSelected('c2')).toBeTrue();
    expect(component.exportsEverything).toBeFalse();

    component.toggleCategory('c2');
    expect(component.isSelected('c2')).toBeFalse();
    expect(component.exportsEverything).toBeTrue();
  });

  it('select-all only adds the categories currently visible', () => {
    setCategories(categories);

    component.categoryFilter = 'гель';
    component.onFilterChange();
    component.selectAllVisible();

    expect(component.selectedCount).toBe(1);
    expect(component.isSelected('c3')).toBeTrue();
  });

  it('clears the selection back to "everything"', () => {
    setCategories(categories);
    component.selectAllVisible();
    expect(component.selectedCount).toBe(3);

    component.clearSelection();
    expect(component.exportsEverything).toBeTrue();
  });

  it('emits the chosen format and categories', () => {
    setCategories(categories);
    component.format = 'image';
    component.toggleCategory('c1');
    component.toggleCategory('c3');

    const emitted = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(emitted);
    component.onConfirm();

    expect(emitted).toHaveBeenCalledWith({ format: 'image', categoryUids: ['c1', 'c3'] });
  });

  it('ignores confirm and close while a download is running', () => {
    component.exporting = true;
    const confirmed = jasmine.createSpy('confirmed');
    const closed = jasmine.createSpy('closed');
    component.confirmed.subscribe(confirmed);
    component.closed.subscribe(closed);

    component.onConfirm();
    component.onClose();

    expect(confirmed).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });
});
