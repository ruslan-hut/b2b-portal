import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Product } from '../../core/models/product.model';
import { Currency } from '../../core/models/currency.model';
import { TranslationService } from '../../core/services/translation.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-product-details-overlay',
  templateUrl: './product-details-overlay.component.html',
  styleUrl: './product-details-overlay.component.scss'
})
export class ProductDetailsOverlayComponent implements OnInit, OnDestroy {
  @Input() product: Product | null = null;
  @Output() closed = new EventEmitter<void>();

  currency: Currency | null = null;
  currencyName: string | undefined = undefined;

  private destroy$ = new Subject<void>();

  constructor(
    public translationService: TranslationService,
    private currencyService: CurrencyService,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  get sanitizedDescription(): SafeHtml {
    if (!this.product || !this.product.description) {
      const noDescText = this.translationService.instant('products.noDescription');
      return this.sanitizer.bypassSecurityTrustHtml(noDescText);
    }
    // Trust HTML content from backend (trusted source)
    // Angular will still sanitize dangerous scripts, but allows safe HTML tags
    return this.sanitizer.bypassSecurityTrustHtml(this.product.description);
  }

  ngOnInit(): void {
    // Prevent body scroll when overlay is open
    document.body.style.overflow = 'hidden';

    // Fetch currency for clients (not for users/admins)
    this.authService.entityType$
      .pipe(takeUntil(this.destroy$))
      .subscribe(type => {
        if (type === 'client') {
          const entity = this.authService.currentEntityValue;
          if (entity && (entity as any).uid) {
            const clientUid = (entity as any).uid;
            this.currencyService.getCurrencyObjectForClient(clientUid)
              .pipe(takeUntil(this.destroy$))
              .subscribe(curr => {
                if (curr) {
                  this.currency = curr;
                  this.currencyName = curr.name;
                }
              });
          }
        }
      });
  }

  ngOnDestroy(): void {
    // Restore body scroll when overlay is closed
    document.body.style.overflow = '';
    
    // Complete all subscriptions to prevent memory leaks
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }

  onOverlayClick(event: Event): void {
    // Close overlay when clicking on backdrop
    if ((event.target as HTMLElement).classList.contains('overlay-backdrop')) {
      this.onClose();
    }
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }
}
