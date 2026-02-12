import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryHeaderComponent } from './category-header.component';

describe('CategoryHeaderComponent', () => {
  let component: CategoryHeaderComponent;
  let fixture: ComponentFixture<CategoryHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CategoryHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display category name', () => {
    component.categoryName = 'Test Category';
    fixture.detectChanges();

    const titleElement = fixture.nativeElement.querySelector('.category-title');
    expect(titleElement).toBeTruthy();
    expect(titleElement.textContent).toContain('Test Category');
  });

  it('should render gradient divider', () => {
    component.categoryName = 'Test Category';
    fixture.detectChanges();

    const dividerElement = fixture.nativeElement.querySelector('.category-divider');
    expect(dividerElement).toBeTruthy();
  });

  it('should have category-header container', () => {
    component.categoryName = 'Test Category';
    fixture.detectChanges();

    const headerElement = fixture.nativeElement.querySelector('.category-header');
    expect(headerElement).toBeTruthy();
  });
});
