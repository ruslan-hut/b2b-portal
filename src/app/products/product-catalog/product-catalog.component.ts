import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { ProductImageCacheService } from '../../core/services/product-image-cache.service';
import { Product } from '../../core/models/product.model';
import { OrderItem, CartAddress, Order } from '../../core/models/order.model';
import { Currency } from '../../core/models/currency.model';
import { Client } from '../../core/models/user.model';
import { TranslationService } from '../../core/services/translation.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { PriceFormattingService } from '../../core/services/price-formatting.service';
import { StoreService } from '../../core/services/store.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { Subscription } from "rxjs";

@Component({
    selector: 'app-product-catalog',
    templateUrl: './product-catalog.component.html',
    styleUrl: './product-catalog.component.scss',
    standalone: false
})
export class ProductCatalogComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;
  searchQuery = '';
  cartItems: OrderItem[] = [];

  // Layout management
  viewMode: 'grid' | 'bulk' = 'bulk';
  selectedProduct: Product | null = null;
  bulkQuantities: Map<string, number> = new Map();

  // Category grouping
  productsByCategory: Map<string, Product[]> = new Map();
  categories: string[] = [];
  allCategories: string[] = [];
  selectedCategory: string = '';

  // Description expansion tracking
  expandedDescriptions: Set<string> = new Set();
  
  // Mobile card expansion tracking
  expandedProductCards: Set<string> = new Set();
  
  // Image preview modal state
  selectedImageForPreview: { url: string; alt: string } | null = null;

  // Product details overlay state
  selectedProductForDetails: Product | null = null;

  // Currency name to display near Price label
  currencyName: string | undefined = undefined;

  // Currency object for formatting prices
  currency: Currency | null = null;

  // Client discount and VAT rates
  currentDiscount: number = 0;
  currentVatRate: number = 0;

  // Address for cart/order
  currentAddress: CartAddress | null = null;
  selectedAddressUid: string | undefined;

  private subscriptions = new Subscription();

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private router: Router,
    public translationService: TranslationService,
    private currencyService: CurrencyService,
    private authService: AuthService,
    private priceFormattingService: PriceFormattingService,
    private storeService: StoreService,
    private appSettingsService: AppSettingsService,
    private cdr: ChangeDetectorRef,
    public imageCacheService: ProductImageCacheService
  ) {
      // Note: bulkQuantities is NOT auto-synced from cart to avoid change detection issues
      // Instead, getBulkQuantity() method falls back to cart values when needed
  }

  ngOnInit(): void {
    // console.log('[ProductCatalog] ngOnInit start');
    // console.log('[ProductCatalog] currentEntityValue at init:', this.authService.currentEntityValue);
    // try {
    //   console.log('[ProductCatalog] BASE_AUTH_DATA at init:', localStorage.getItem('BASE_AUTH_DATA'));
    // } catch (e) {
    //   // ignore
    // }

    this.loadProducts();
    this.orderService.currentOrder$.subscribe(items => {
      this.cartItems = items;
    });

    // Subscribe to draft order changes to get address data
    this.subscriptions.add(
      this.orderService.currentDraftOrder$.subscribe((order: Order | null) => {
        if (order) {
          this.currentAddress = order.address || null;
          this.selectedAddressUid = order.address?.uid;
          // If VAT rate changed, reload products to update prices
          if (order.vatRateChanged) {
            console.log('[Address Change] VAT rate changed, reloading products');
            this.loadProducts();
          }
        } else {
          this.currentAddress = null;
          this.selectedAddressUid = undefined;
        }
      })
    );

    // Subscribe to AppSettings for currency, discount, and VAT rates
    this.appSettingsService.settings$.subscribe(settings => {
      if (settings) {
        // Set currency from AppSettings
        if (settings.currency) {
          this.currency = settings.currency;
          this.currencyName = settings.currency.name;
        }

        // Set discount and VAT rate for clients
        if (settings.entity_type === 'client') {
          const client = settings.entity as Client;
          this.currentDiscount = client.discount || 0;
          // Use effective VAT rate from AppSettings (already calculated by backend)
          this.currentVatRate = settings.effective_vat_rate || 0;
        } else {
          this.currentDiscount = 0;
          this.currentVatRate = 0;
        }
      } else {
        // No settings available
        this.currency = null;
        this.currencyName = undefined;
        this.currentDiscount = 0;
        this.currentVatRate = 0;
      }
    });

    // Subscribe to view mode changes from the service
    this.productService.viewMode$.subscribe(mode => {
      this.viewMode = mode;
      // Re-apply filters when view mode changes to ensure bulk view shows only available products
      if (this.products.length > 0) {
        this.applyFilters();
      }
    });

    // Subscribe to language changes and reload products with new language descriptions
    this.translationService.currentLanguage$.subscribe(language => {
      // Only reload if products are already loaded (skip initial load)
      if (this.products.length > 0) {
        console.log(`[Language Change] Reloading products for language: ${language}`);
        this.loadProducts();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadProducts(): void {
    this.loading = true;
    // Use frontend endpoint that returns products with all calculated prices
    const category = this.selectedCategory || undefined;
    this.productService.getFrontendProducts(0, 1000, category).subscribe({
      next: (products) => {
        this.products = this.sortProductsByCategoryAndName(products);
        this.extractAllCategories(products);
        // Filter to show only available products in bulk view
        this.filteredProducts = this.products.filter(p => p.inStock);
        this.groupProductsByCategory(this.filteredProducts);
        this.loading = false;
        // Set first product as selected by default in bulk view
        if (this.filteredProducts.length > 0) {
          this.selectedProduct = this.filteredProducts[0];
        }

        // Load product images from cache or API
        const productUids = products.map(p => p.id);
        if (productUids.length > 0) {
          this.imageCacheService.loadMainImages(productUids).subscribe({
            next: () => {
              // Images loaded, trigger change detection to update view
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Error loading product images:', err);
            }
          });
        }

        // currencyName is resolved via auth.currentEntity$ subscription; no local fallback needed here.
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.loading = false;
      }
    });
  }

  extractAllCategories(products: Product[]): void {
    const categorySet = new Set<string>();
    products.forEach(product => categorySet.add(product.category));
    this.allCategories = Array.from(categorySet).sort();
  }

  sortProductsByCategoryAndName(products: Product[]): Product[] {
    return products.sort((a, b) => {
      // First sort by category
      // const categoryCompare = a.category.localeCompare(b.category);
      // if (categoryCompare !== 0) {
      //   return categoryCompare;
      // }

      // Within same category: sort by isNew first (new products first)
      const aIsNew = a.isNew ? 1 : 0;
      const bIsNew = b.isNew ? 1 : 0;
      if (aIsNew !== bIsNew) {
        return bIsNew - aIsNew; // New products first
      }

      // Then sort by sortOrder (lower numbers first)
      const aSortOrder = a.sortOrder ?? 999999;
      const bSortOrder = b.sortOrder ?? 999999;
      if (aSortOrder !== bSortOrder) {
        return aSortOrder - bSortOrder;
      }

      // Finally sort by name
      return a.name.localeCompare(b.name);
    });
  }

  groupProductsByCategory(products: Product[]): void {
    this.productsByCategory.clear();
    this.categories = [];

    products.forEach(product => {
      if (!this.productsByCategory.has(product.category)) {
        this.productsByCategory.set(product.category, []);
        this.categories.push(product.category);
      }
      this.productsByCategory.get(product.category)!.push(product);
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onCategoryChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.products];

    // Filter to show only available products in bulk view
    if (this.viewMode === 'bulk') {
      filtered = filtered.filter(p => p.inStock);
    }

    // Filter by category if selected
    if (this.selectedCategory) {
      filtered = filtered.filter(p => p.category === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
      );
    }

    this.filteredProducts = this.sortProductsByCategoryAndName(filtered);
    this.groupProductsByCategory(this.filteredProducts);
  }

  addToCart(product: Product): void {
    // No stock validation here - validation happens only on order confirmation
    const orderItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      price: product.price,
      subtotal: 0, // Placeholder - backend will calculate
      sortOrder: product.sortOrder
    };

    // Add to local cart
    this.orderService.addToCart(orderItem);

    // Save to backend - backend calculates discount/VAT and updates local cart
    // Pass current address UID if available
    this.orderService.saveDraftCart(this.selectedAddressUid).subscribe({
      next: () => {
        // Cart updated with backend calculations
      },
      error: (err) => {
        console.error('Failed to save cart:', err);
      }
    });
  }

  removeFromCart(productId: string): void {
    // Remove from local state
    this.orderService.removeFromCart(productId);

    // Persist to backend - sends complete cart state
    this.orderService.saveDraftCart(this.selectedAddressUid).subscribe({
      next: () => {
        // Cart updated with backend calculations
      },
      error: (err) => {
        console.error('Failed to save cart after removal:', err);
      }
    });
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    // No stock validation here - validation happens only on order confirmation
    this.orderService.updateCartItemQuantity(productId, quantity);

    // Persist to backend - sends complete cart state
    this.orderService.saveDraftCart(this.selectedAddressUid).subscribe({
      next: () => {
        // Cart updated with backend calculations
      },
      error: (err) => {
        console.error('Failed to save cart after quantity update:', err);
      }
    });
  }

  // Layout management methods
  selectProduct(product: Product): void {
    this.selectedProduct = product;
  }

  getBulkQuantity(productId: string): number {
    // First check if there's a bulk quantity set
    if (this.bulkQuantities.has(productId)) {
      return this.bulkQuantities.get(productId) || 0;
    }

    // Otherwise, check if the product is in the cart (read-only, no side effects)
    const cartItem = this.cartItems.find(item => item.productId === productId);
    return cartItem ? cartItem.quantity : 0;
  }

  setBulkQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.bulkQuantities.delete(productId);
      // Also remove from cart if it exists
      this.removeFromCart(productId);
    } else {
      this.bulkQuantities.set(productId, quantity);
    }
  }

    addBulkToCart(): void {
        // Build the updated cart directly from bulk quantities
        const updatedCart: OrderItem[] = [];

        this.bulkQuantities.forEach((quantity, productId) => {
            if (quantity > 0) {
                const product = this.products.find(p => p.id === productId);
                if (product && product.inStock) {
                    // Check if item is already in cart
                    const existingItem = this.cartItems.find(item => item.productId === productId);

                    if (existingItem) {
                        // Update quantity in existing item
                        updatedCart.push({
                            ...existingItem,
                            quantity: quantity
                        });
                    } else {
                        // Add new item
                        updatedCart.push({
                            productId: product.id,
                            productName: product.name,
                            quantity: quantity,
                            price: product.price,
                            subtotal: 0, // Backend will calculate
                            isNew: product.isNew,
                            sortOrder: product.sortOrder
                        });
                    }
                }
            }
        });

        if (updatedCart.length > 0) {
            // Update local cart state with new quantities (keeping old subtotals for now)
            this.orderService.setCart(updatedCart);

            // Save to backend - backend will recalculate everything and update cart
            // Pass current address UID if available
            this.orderService.saveDraftCart(this.selectedAddressUid).subscribe({
                next: draftOrder => {
                    // Cart updated with backend calculations
                    console.log('Draft saved with backend calculations', draftOrder);
                    // Clear bulk quantities after successful save
                    this.bulkQuantities.clear();
                    // Trigger change detection to update the view (fixes NG0100 error)
                    this.cdr.detectChanges();
                },
                error: err => {
                    console.error('Failed to save draft cart:', err);
                    alert(this.translationService.instant('product.saveDraftFailed') || 'Failed to save cart draft');
                }
            });
        }
    }

    hasBulkItems(): boolean {
        return this.bulkQuantities.size > 0 || this.cartItems.length > 0;
    }

  isInCart(productId: string): boolean {
    return this.cartItems.some(item => item.productId === productId);
  }

  getCartQuantity(productId: string): number {
    const cartItem = this.cartItems.find(item => item.productId === productId);
    return cartItem ? cartItem.quantity : 0;
  }

  getCartTotal(): number {
    // Use backend-calculated total from draft order
    // Backend is the single source of truth for all calculations
    const draftOrder = this.orderService.currentDraftOrderValue;
    if (draftOrder && draftOrder.totalAmount) {
      return draftOrder.totalAmount;
    }
    
    // Fallback: if no draft order, sum item subtotals (which should come from backend)
    // Note: This is a temporary fallback. In normal flow, draft order should always exist
    return this.cartItems.reduce((sum, item) => {
      // Use backend-calculated subtotal if available, otherwise fallback to price * quantity
      return sum + (item.subtotal || (item.price * item.quantity));
    }, 0);
  }

  /**
   * Get item subtotal with VAT included for display
   * IMPORTANT: For items in cart, ONLY uses backend-calculated values
   * For items NOT in cart, calculates PREVIEW total for display only
   */
  getItemSubtotalWithVat(product: Product, quantity: number): number {
    if (quantity <= 0) return 0;

    // Find cart item
    const cartItem = this.cartItems.find(item => item.productId === product.id);

    if (cartItem && cartItem.subtotal) {
      // Check if the quantity we're displaying matches the cart item quantity
      // If not, we're in the middle of an update - calculate preview
      if (quantity !== cartItem.quantity) {
        // Quantity changed but backend hasn't responded yet - show preview
        // Use price from API (already calculated)
        const priceWithVat = this.getPriceWithVat(product);
        return priceWithVat * quantity;
      }

      // Quantities match - use backend-calculated subtotal (AUTHORITATIVE)
      return cartItem.subtotal;
    }

    // Item not in cart - use price from API (already calculated by backend)
    const priceWithVat = this.getPriceWithVat(product);
    return priceWithVat * quantity;
  }

    /**
     * Get product image URL (from cache or placeholder)
     * Uses cached Base64 images if available, otherwise falls back to imageUrl from product or placeholder
     */
    getProductImageUrl(product: Product): string {
        // First check if we have a cached image from the database
        if (this.imageCacheService.hasImageUrl(product.id)) {
            return this.imageCacheService.getImageUrl(product.id);
        }
        // Fall back to imageUrl from product data (URL-based images)
        if (product.imageUrl) {
            return product.imageUrl;
        }
        // Default placeholder
        return this.imageCacheService.getPlaceholderUrl();
    }

    /**
     * Handle image load errors by setting a placeholder image
     */
    onImageError(event: Event): void {
        const imgElement = event.target as HTMLImageElement;
        imgElement.src = 'assets/images/product-placeholder.svg';
    }

    /**
     * Toggle description expansion for a product
     */
    toggleDescription(productId: string): void {
        if (this.expandedDescriptions.has(productId)) {
            this.expandedDescriptions.delete(productId);
        } else {
            this.expandedDescriptions.add(productId);
        }
    }

    /**
     * Check if a product's description is expanded
     */
    isDescriptionExpanded(productId: string): boolean {
        return this.expandedDescriptions.has(productId);
    }

    /**
     * Toggle product card expansion for mobile
     */
    toggleProductCard(productId: string): void {
        if (this.expandedProductCards.has(productId)) {
            this.expandedProductCards.delete(productId);
        } else {
            this.expandedProductCards.add(productId);
        }
    }

    /**
     * Check if a product card is expanded
     */
    isProductCardExpanded(productId: string): boolean {
        return this.expandedProductCards.has(productId);
    }

    /**
     * Handle quantity increment (mobile - auto-updates cart)
     */
    incrementQuantity(productId: string, product: Product): void {
        if (!product.inStock) return;
        const currentQty = this.getBulkQuantity(productId);
        const newQty = currentQty + 1;
        this.updateQuantityAndCart(productId, product, newQty);
    }

    /**
     * Handle quantity decrement (mobile - auto-updates cart)
     */
    decrementQuantity(productId: string, product: Product): void {
        const currentQty = this.getBulkQuantity(productId);
        if (currentQty > 0) {
            const newQty = currentQty - 1;
            this.updateQuantityAndCart(productId, product, newQty);
        }
    }

    /**
     * Update quantity and automatically update cart (for mobile view)
     */
    updateQuantityAndCart(productId: string, product: Product, quantity: number): void {
        // Update the bulk quantities map
        if (quantity <= 0) {
            this.bulkQuantities.delete(productId);
            this.removeFromCart(productId);
        } else {
            this.bulkQuantities.set(productId, quantity);
            // Automatically update/add to cart (local state)
            const existingItem = this.cartItems.find(item => item.productId === productId);

            if (existingItem) {
                // Update existing cart item
                this.orderService.updateCartItemQuantity(productId, quantity);
            } else {
                // Add new item to cart (local state only)
                const orderItem: OrderItem = {
                    productId: product.id,
                    productName: product.name,
                    quantity: quantity,
                    price: product.price,
                    subtotal: 0, // Placeholder - backend will calculate
                    sortOrder: product.sortOrder
                };
                this.orderService.addToCart(orderItem);
            }

            // Save to backend - backend calculates discount/VAT
            // Pass current address UID if available
            this.orderService.saveDraftCart(this.selectedAddressUid).subscribe({
                next: () => {
                    // Cart updated with backend calculations
                },
                error: (err) => {
                    console.error('Failed to save cart:', err);
                }
            });
        }
    }

    /**
     * Handle quantity input change (mobile - auto-updates cart)
     */
    onMobileQuantityChange(productId: string, product: Product, value: number): void {
        const quantity = Math.max(0, value || 0);
        this.updateQuantityAndCart(productId, product, quantity);
    }

    /**
     * Open full-size image preview
     */
    openImagePreview(imageUrl: string, productName: string, event: Event): void {
        event.stopPropagation();
        this.selectedImageForPreview = {
            url: imageUrl || 'assets/images/product-placeholder.svg',
            alt: productName
        };
    }

  /**
   * Close full-size image preview
   */
  closeImagePreview(): void {
    this.selectedImageForPreview = null;
  }

  /**
   * Open product details overlay
   */
  openProductDetails(product: Product, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedProductForDetails = product;
  }

  /**
   * Close product details overlay
   */
  closeProductDetails(): void {
    this.selectedProductForDetails = null;
  }

  /**
   * Get discounted price for display
   * For items in cart, uses backend-calculated priceDiscount
   * For items not in cart, uses priceWithDiscount from API
   */
  getDiscountedPrice(productId: string, originalPrice: number): number {
    // Check if item is in cart - backend calculates priceDiscount
    const cartItem = this.cartItems.find(item => item.productId === productId);
    if (cartItem && cartItem.priceDiscount !== undefined) {
      return cartItem.priceDiscount;
    }
    
    // Item not in cart - use priceWithDiscount from API (already calculated)
    const product = this.products.find(p => p.id === productId);
    if (product) {
      const productWithPrices = product as Product & { priceWithDiscount?: number };
      if (productWithPrices.priceWithDiscount !== undefined) {
        return productWithPrices.priceWithDiscount;
      }
    }
    
    // Fallback to original price
    return originalPrice;
  }

  /**
   * Check if current client has discount
   */
  hasDiscount(): boolean {
    return this.currentDiscount > 0;
  }

  /**
   * Get savings amount for display
   * Uses backend-calculated values from cart items
   */
  getSavingsAmount(productId: string, originalPrice: number): number {
    const cartItem = this.cartItems.find(item => item.productId === productId);
    if (cartItem && cartItem.priceDiscount !== undefined) {
      // Calculate savings: original - discounted (both from backend)
      return originalPrice - cartItem.priceDiscount;
    }
    
    // Item not in cart - calculate from API prices
    const product = this.products.find(p => p.id === productId);
    if (product) {
      const productWithPrices = product as Product & { basePrice?: number; priceWithDiscount?: number };
      if (productWithPrices.basePrice !== undefined && productWithPrices.priceWithDiscount !== undefined) {
        return productWithPrices.basePrice - productWithPrices.priceWithDiscount;
      }
    }
    
    return 0;
  }

  /**
   * Get final price with VAT and discount for display
   * Uses backend-calculated price_final from frontend products endpoint
   */
  getPriceWithVat(product: Product): number {
    // Check if product has calculated prices from frontend endpoint
    const productWithPrices = product as Product & { priceFinal?: number; priceWithVat?: number };
    if (productWithPrices.priceFinal !== undefined) {
      return productWithPrices.priceFinal;
    }
    // Fallback to regular price if calculated prices not available
    return product.price;
  }

  /**
   * Get original price with VAT (no discount applied) for display
   * Uses backend-calculated price_with_vat from frontend products endpoint
   */
  getOriginalPriceWithVat(product: Product): number {
    // Check if product has calculated prices from frontend endpoint
    const productWithPrices = product as Product & { priceWithVat?: number; basePrice?: number; vatRate?: number };
    if (productWithPrices.priceWithVat !== undefined) {
      return productWithPrices.priceWithVat;
    }
    // Fallback calculation if not available
    if (productWithPrices.basePrice !== undefined && productWithPrices.vatRate !== undefined) {
      return productWithPrices.basePrice * (1 + productWithPrices.vatRate / 100);
    }
    return product.price * (1 + this.currentVatRate / 100);
  }

}
