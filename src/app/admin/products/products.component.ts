import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminService, AdminProductWithDetails, ProductCountryAvailability } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { ProductService } from '../../core/services/product.service';
import { ClientService } from '../../core/services/client.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { formatDateTime } from '../../core/utils/date-format';
import { ToggleState, ExpandState } from '../../core/utils/ui-state';

interface FilterOption {
  value: string;
  label: string;
}

@Component({
    selector: 'app-products',
    templateUrl: './products.component.html',
    styleUrls: ['./products.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
      // Clicking anywhere else (or pressing Escape) dismisses the open country
      // list; the badge itself stops propagation so it can still toggle.
      '(document:click)': 'onDocumentClick($event)',
      '(document:keydown.escape)': 'closeAvailability()',
      // The panel is positioned against the viewport, so any scroll or resize
      // would leave it stranded next to the wrong row: dismiss it instead.
      '(window:resize)': 'closeAvailability()'
    }
})
export class ProductsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  products: AdminProductWithDetails[] = [];
  loading = false;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;
  
  // Filters
  selectedLanguage: string = '';
  selectedStore: string = '';
  // True when the logged-in user is a store-scoped manager: the store filter
  // is locked to their store and hidden from the UI.
  storeLocked = false;
  selectedPriceType: string = '';
  selectedCategory: string = '';
  searchTerm = '';

  // Mobile UI state
  filters = new ToggleState();
  cards = new ExpandState();

  // Filter options
  languages: FilterOption[] = [];
  stores: FilterOption[] = [];
  priceTypes: FilterOption[] = [];
  categories: FilterOption[] = [];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private translationService: TranslationService,
    private productService: ProductService,
    private clientService: ClientService,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Products');
    // Scroll does not bubble, so the host bindings never see the table's own
    // horizontal scroll — listen in the capture phase to catch every scroller.
    document.addEventListener('scroll', this.onDocumentScroll, true);
    // Refresh user data from server to get latest price_type_uid and store_uid
    this.subscriptions.add(
      this.authService.getCurrentEntity().subscribe({
        next: (entity) => {
          this.initializeDefaults(entity);
          this.loadFilterOptions();
        },
        error: (err) => {
          console.warn('Failed to refresh user data, using cached:', err);
          // Fallback to cached data if refresh fails
          this.initializeDefaults(this.authService.currentEntityValue);
          this.loadFilterOptions();
        }
      })
    );
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onDocumentScroll, true);
    this.subscriptions.unsubscribe();
  }

  private readonly onDocumentScroll = (event: Event): void => {
    // Scrolling the panel's own country list must not dismiss it; only the page
    // or the table moving out from under it should.
    const target = event.target;
    if (target instanceof Element && target.closest('.prd-cert-panel')) return;
    this.closeAvailability();
  };

  initializeDefaults(entity: any): void {
    // Set default language from current site language
    this.selectedLanguage = this.translationService.getCurrentLanguage();

    // Set defaults from authenticated user/client
    if (entity) {
      // Set store_uid if available (both User and Client can have it)
      if ('store_uid' in entity && entity.store_uid) {
        this.selectedStore = entity.store_uid;
        console.log('[Products] Setting default store:', entity.store_uid);
      }

      // Store-scoped managers are locked to their own store.
      this.storeLocked = this.authService.isStoreScopedManager();
      if (this.storeLocked) {
        this.selectedStore = this.authService.scopedStoreUid ?? this.selectedStore;
      }
      
      // Set price_type_uid if available (Client has it, User might have it)
      if ('price_type_uid' in entity && entity.price_type_uid) {
        this.selectedPriceType = entity.price_type_uid;
        console.log('[Products] Setting default price type:', entity.price_type_uid);
      } else {
        console.log('[Products] No price_type_uid found in entity:', entity);
      }
    } else {
      console.warn('[Products] No entity available for defaults');
    }
  }

  loadFilterOptions(): void {
    // Country names for the certification panel; failure only costs the names.
    this.subscriptions.add(
      this.clientService.getCountries().subscribe({
        next: (countries) => {
          this.countryNames = new Map(countries.map(c => [c.country_code.toUpperCase(), c.name]));
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Failed to load countries:', err)
      })
    );

    // Load languages
    this.subscriptions.add(
      this.adminService.getAvailableLanguages().subscribe({
        next: (langs) => {
          this.languages = [{ value: '', label: 'All Languages' }, ...langs.map(l => ({ value: l, label: l.toUpperCase() }))];
        }
      })
    );

    // Load stores
    this.subscriptions.add(
      this.adminService.listStores().subscribe({
        next: (stores) => {
          this.stores = [{ value: '', label: 'All Stores' }, ...stores.map((s: any) => ({ value: s.uid, label: s.name || s.uid }))];
          // After stores are loaded, load products to ensure store filter works
          this.loadProducts();
        },
        error: (err) => {
          console.error('Failed to load stores:', err);
          this.loadProducts();
        }
      })
    );

    // Load price types
    this.subscriptions.add(
      this.adminService.listPriceTypes().subscribe({
        next: (priceTypes) => {
          this.priceTypes = [{ value: '', label: 'All Price Types' }, ...priceTypes.map((pt: any) => ({ value: pt.uid, label: pt.name || pt.uid }))];
        },
        error: (err) => console.error('Failed to load price types:', err)
      })
    );

    // Load categories with descriptions
    this.subscriptions.add(
      this.adminService.listCategories().subscribe({
        next: (categories) => {
          if (categories.length === 0) {
            this.categories = [{ value: '', label: 'All Categories' }];
            return;
          }

          // Get category UIDs
          const categoryUIDs = categories.map((c: any) => c.uid);
          const currentLanguage = this.translationService.getCurrentLanguage();

          // Fetch category descriptions for current language
          this.subscriptions.add(
            this.productService.getBatchCategoryDescriptions(categoryUIDs, currentLanguage).subscribe({
              next: (descriptionsMap) => {
                // Map categories with descriptions
                this.categories = [
                  { value: '', label: 'All Categories' },
                  ...categories.map((c: any) => {
                    const description = descriptionsMap.get(c.uid);
                    // Use description name if available, otherwise fallback to UID
                    const label = description || c.uid;
                    return { value: c.uid, label: label };
                  })
                ];
              },
              error: (err) => {
                console.error('Failed to load category descriptions:', err);
                // Fallback to UIDs if descriptions fail
                this.categories = [{ value: '', label: 'All Categories' }, ...categories.map((c: any) => ({ value: c.uid, label: c.uid }))];
              }
            })
          );
        },
        error: (err) => {
          console.error('Failed to load categories:', err);
          this.categories = [{ value: '', label: 'All Categories' }];
        }
      })
    );
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;

    const params: any = {
      page: this.currentPage,
      count: this.pageSize
    };

    if (this.selectedLanguage) {
      params.language = this.selectedLanguage;
    }
    if (this.selectedStore) {
      params.store = this.selectedStore;
    }
    if (this.selectedPriceType) {
      params.price_type = this.selectedPriceType;
    }
    if (this.selectedCategory) {
      params.category = this.selectedCategory;
    }
    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    this.subscriptions.add(
      this.adminService.getProductsWithDetails(params).subscribe({
        next: (response) => {
          this.products = response.data || [];

          // Set pagination values from pagination field (backend uses 'pagination', not 'metadata')
          if (response.pagination) {
            this.total = response.pagination.total || 0;
            this.totalPages = response.pagination.total_pages || Math.ceil(this.total / this.pageSize);
          } else {
            // If no pagination, we can't determine total, so assume single page
            // This should not happen if API is working correctly
            console.warn('[Products] No pagination in response, pagination may not work correctly');
            this.total = this.products.length;
            this.totalPages = 1;
          }

          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load products:', err);
          this.error = 'Failed to load products';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    
    // If language changed, reload category descriptions
    if (this.selectedLanguage) {
      this.refreshCategoryDescriptions();
    }
    
    this.loadProducts();
  }

  refreshCategoryDescriptions(): void {
    // Reload categories with descriptions for the selected language
    this.subscriptions.add(
      this.adminService.listCategories().subscribe({
        next: (categories) => {
          if (categories.length === 0) {
            return;
          }

          const categoryUIDs = categories.map((c: any) => c.uid);
          const language = this.selectedLanguage || this.translationService.getCurrentLanguage();

          this.subscriptions.add(
            this.productService.getBatchCategoryDescriptions(categoryUIDs, language).subscribe({
              next: (descriptionsMap) => {
                // Update category labels with new descriptions
                this.categories = [
                  { value: '', label: 'All Categories' },
                  ...categories.map((c: any) => {
                    const description = descriptionsMap.get(c.uid);
                    const label = description || c.uid;
                    return { value: c.uid, label: label };
                  })
                ];
              },
              error: (err) => {
                console.error('Failed to refresh category descriptions:', err);
              }
            })
          );
        },
        error: (err) => {
          console.error('Failed to reload categories:', err);
        }
      })
    );
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadProducts();
    }
  }

  formatDate(dateString?: string): string {
    return formatDateTime(dateString);
  }

  formatPrice(price?: number): string {
    if (price === undefined || price === null) return '-';
    // Price is in cents, convert to dollars
    return (price / 100).toFixed(2);
  }

  // --- Country availability (certification) badge ---------------------------
  // The rows come with the product list; the badge only opens and closes a
  // panel, so there is no extra request when an admin inspects a product.

  /** UID of the product whose country list is open, null when none is. */
  openAvailabilityUid: string | null = null;

  availabilityRows(product: AdminProductWithDetails): ProductCountryAvailability[] {
    return product.country_availability ?? [];
  }

  /** Products with no rows show no badge at all — nothing to open. */
  hasAvailability(product: AdminProductWithDetails): boolean {
    return this.availabilityRows(product).length > 0;
  }

  availabilityCount(product: AdminProductWithDetails): number {
    return this.availabilityRows(product).length;
  }

  isAvailabilityOpen(product: AdminProductWithDetails): boolean {
    return this.openAvailabilityUid === product.uid;
  }

  /**
   * Viewport coordinates of the open panel. The table scrolls horizontally, so
   * a panel positioned inside the cell would be clipped by that overflow; it is
   * rendered `position: fixed` instead and placed by hand off the badge's rect.
   */
  availabilityPanelTop = 0;
  availabilityPanelLeft = 0;

  /** Fallback size used before the panel exists; the stylesheet caps both. */
  private static readonly PANEL_W = 320;
  private static readonly PANEL_H = 320;
  private static readonly PANEL_GAP = 4;
  private static readonly PANEL_MARGIN = 8;

  toggleAvailability(product: AdminProductWithDetails, event: Event): void {
    event.stopPropagation();
    if (this.isAvailabilityOpen(product)) {
      this.openAvailabilityUid = null;
    } else {
      this.openAvailabilityUid = product.uid;
      const badge = event.currentTarget as HTMLElement | null;
      // Place it off an estimate first so it never paints at 0,0, then measure
      // the rendered panel — its width follows the country names.
      this.positionAvailabilityPanel(badge, ProductsComponent.PANEL_W, ProductsComponent.PANEL_H);
      requestAnimationFrame(() => {
        const panel = document.querySelector('.prd-cert-panel') as HTMLElement | null;
        if (!panel || this.openAvailabilityUid !== product.uid) return;
        this.positionAvailabilityPanel(badge, panel.offsetWidth, panel.offsetHeight);
        this.cdr.markForCheck();
      });
    }
    this.cdr.markForCheck();
  }

  /** Anchors the panel under the badge, flipping when it would leave the viewport. */
  private positionAvailabilityPanel(badge: HTMLElement | null, width: number, height: number): void {
    if (!badge) return;
    const rect = badge.getBoundingClientRect();
    const gap = ProductsComponent.PANEL_GAP;
    const margin = ProductsComponent.PANEL_MARGIN;

    const below = window.innerHeight - rect.bottom - gap - margin;
    this.availabilityPanelTop = below >= height ? rect.bottom + gap : Math.max(margin, rect.top - gap - height);

    const maxLeft = window.innerWidth - width - margin;
    this.availabilityPanelLeft = Math.max(margin, Math.min(rect.left, maxLeft));
  }

  /** Any click outside the open panel dismisses it — its scrollbars included. */
  onDocumentClick(event: Event): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.prd-cert-panel')) return;
    this.closeAvailability();
  }

  closeAvailability(): void {
    if (this.openAvailabilityUid !== null) {
      this.openAvailabilityUid = null;
      this.cdr.markForCheck();
    }
  }

  /** ISO code → country name, empty until the countries request lands. */
  private countryNames = new Map<string, string>();

  /** Label for a row: the ISO code, or "any country" for the wildcard row. */
  availabilityCountryLabel(row: ProductCountryAvailability): string {
    return row.country_code || this.translationService.instant('admin.products.anyCountry');
  }

  /** Resolved country name, or '' when the code is unknown or is the wildcard. */
  availabilityCountryName(row: ProductCountryAvailability): string {
    if (!row.country_code) return '';
    return this.countryNames.get(row.country_code.toUpperCase()) ?? '';
  }

  textColorFor(hex: string): string {
    const c = (hex || '').replace('#', '');
    if (c.length !== 3 && c.length !== 6) return '#fff';
    const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.6 ? '#1a1a1a' : '#ffffff';
  }
}
