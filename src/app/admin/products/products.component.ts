import { Component, OnInit } from '@angular/core';
import { AdminService, AdminProductWithDetails, AdminProductsResponse } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { ProductService } from '../../core/services/product.service';

interface FilterOption {
  value: string;
  label: string;
}

@Component({
    selector: 'app-products',
    templateUrl: './products.component.html',
    styleUrls: ['./products.component.scss'],
    standalone: false
})
export class ProductsComponent implements OnInit {
  products: AdminProductWithDetails[] = [];
  filteredProducts: AdminProductWithDetails[] = [];
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
  selectedPriceType: string = '';
  selectedCategory: string = '';
  searchTerm = '';

  // Filter options
  languages: FilterOption[] = [];
  stores: FilterOption[] = [];
  priceTypes: FilterOption[] = [];
  categories: FilterOption[] = [];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private translationService: TranslationService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    // Refresh user data from server to get latest price_type_uid and store_uid
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
    });
  }

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
    // Load languages
    this.adminService.getAvailableLanguages().subscribe({
      next: (langs) => {
        this.languages = [{ value: '', label: 'All Languages' }, ...langs.map(l => ({ value: l, label: l.toUpperCase() }))];
      }
    });

    // Load stores
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
    });

    // Load price types
    this.adminService.listPriceTypes().subscribe({
      next: (priceTypes) => {
        this.priceTypes = [{ value: '', label: 'All Price Types' }, ...priceTypes.map((pt: any) => ({ value: pt.uid, label: pt.name || pt.uid }))];
      },
      error: (err) => console.error('Failed to load price types:', err)
    });

    // Load categories with descriptions
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
        });
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
        this.categories = [{ value: '', label: 'All Categories' }];
      }
    });
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

    this.adminService.getProductsWithDetails(params).subscribe({
      next: (response) => {
        this.products = response.data || [];
        this.total = response.metadata?.total || this.products.length;
        this.totalPages = response.metadata?.total_pages || Math.ceil(this.total / this.pageSize);
        this.applySearch();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.error = 'Failed to load products';
        this.loading = false;
      }
    });
  }

  applySearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredProducts = [...this.products];
      return;
    }

    const search = this.searchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(product =>
      product.uid.toLowerCase().includes(search) ||
      product.sku?.toLowerCase().includes(search) ||
      product.product_name?.toLowerCase().includes(search) ||
      product.category_uid?.toLowerCase().includes(search) ||
      product.category_name?.toLowerCase().includes(search)
    );
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
    this.adminService.listCategories().subscribe({
      next: (categories) => {
        if (categories.length === 0) {
          return;
        }

        const categoryUIDs = categories.map((c: any) => c.uid);
        const language = this.selectedLanguage || this.translationService.getCurrentLanguage();

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
        });
      },
      error: (err) => {
        console.error('Failed to reload categories:', err);
      }
    });
  }

  onSearchChange(): void {
    this.applySearch();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadProducts();
    }
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  formatPrice(price?: number): string {
    if (price === undefined || price === null) return '-';
    // Price is in cents, convert to dollars
    return (price / 100).toFixed(2);
  }
}
