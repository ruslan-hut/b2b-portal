import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImagePreviewModalComponent } from './image-preview-modal.component';

describe('ImagePreviewModalComponent', () => {
  let component: ImagePreviewModalComponent;
  let fixture: ComponentFixture<ImagePreviewModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImagePreviewModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImagePreviewModalComponent);
    component = fixture.componentInstance;

    // Set required inputs
    component.imageUrl = 'test-image.jpg';
    component.altText = 'Test Product';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display image with correct src', () => {
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('.image-preview-img');
    expect(img.src).toContain('test-image.jpg');
  });

  it('should display image with alt text', () => {
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('.image-preview-img');
    expect(img.alt).toBe('Test Product');
  });

  it('should display caption with alt text', () => {
    fixture.detectChanges();
    const caption = fixture.nativeElement.querySelector('.image-preview-caption');
    expect(caption.textContent).toBe('Test Product');
  });

  it('should emit closed when backdrop clicked', () => {
    spyOn(component.closed, 'emit');
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.image-preview-overlay');
    backdrop.click();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('should emit closed when close button clicked', () => {
    spyOn(component.closed, 'emit');
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('.image-preview-close');
    closeButton.click();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('should emit closed when ESC key pressed', () => {
    spyOn(component.closed, 'emit');
    component.onEscKey();
    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('should not close when clicking inside container', () => {
    spyOn(component.closed, 'emit');
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.image-preview-container');
    container.click();

    // Event propagation is stopped in template, so closed should not be emitted
    expect(component.closed.emit).not.toHaveBeenCalled();
  });

  it('should handle image error with placeholder', () => {
    const imgElement = document.createElement('img');
    const event = { target: imgElement } as any;

    component.onImageError(event);

    expect(imgElement.src).toContain('product-placeholder.svg');
  });
});
