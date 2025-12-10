import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { Product } from '../../core/models/product.model';
import { OrderItem } from '../../core/models/order.model';
import { Currency } from '../../core/models/currency.model';
import { TranslationService } from '../../core/services/translation.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-product-catalog',
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent implements OnInit {
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

  // Currency name to display near Price label
  currencyName: string | undefined = undefined;

  // Currency object for formatting prices
  currency: Currency | null = null;

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private router: Router,
    public translationService: TranslationService,
    private currencyService: CurrencyService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('[ProductCatalog] ngOnInit start');
    console.log('[ProductCatalog] currentEntityValue at init:', this.authService.currentEntityValue);
    try {
      console.log('[ProductCatalog] BASE_AUTH_DATA at init:', localStorage.getItem('BASE_AUTH_DATA'));
    } catch (e) {
      // ignore
    }

    this.loadProducts();
    this.orderService.currentOrder$.subscribe(items => {
      this.cartItems = items;
    });

    // Fetch currency for clients (not for users/admins)
    this.authService.entityType$.subscribe(type => {
      if (type === 'client') {
        const entity = this.authService.currentEntityValue;
        if (entity && (entity as any).uid) {
          const clientUid = (entity as any).uid;
          // Get full currency object for formatting
          this.currencyService.getCurrencyObjectForClient(clientUid).subscribe(curr => {
            if (curr) {
              this.currency = curr;
              this.currencyName = curr.name;
            }
          });
        }
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

  loadProducts(): void {
    this.loading = true;
    // Use getProductsWithAvailability to fetch products with available quantity information
    this.productService.getProductsWithAvailability().subscribe({
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
      const categoryCompare = a.category.localeCompare(b.category);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }
      // Then sort by name within the same category
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
      subtotal: product.price
    };

    this.orderService.addToCart(orderItem);
  }

  removeFromCart(productId: string): void {
    this.orderService.removeFromCart(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    // No stock validation here - validation happens only on order confirmation
    this.orderService.updateCartItemQuantity(productId, quantity);
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
    
    // Otherwise, check if the product is in the cart
    const cartItem = this.cartItems.find(item => item.productId === productId);
    const cartQuantity = cartItem ? cartItem.quantity : 0;
    
    // Sync bulkQuantities with cart if cart has quantity
    if (cartQuantity > 0) {
      this.bulkQuantities.set(productId, cartQuantity);
    }
    
    return cartQuantity;
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
        let itemsUpdated = 0;

        // Process all products that have bulk quantities set
        // No stock validation here - validation happens only on order confirmation
        this.bulkQuantities.forEach((quantity, productId) => {
            if (quantity > 0) {
                const product = this.products.find(p => p.id === productId);
                if (product && product.inStock) {
                    // Check if item is already in cart
                    const existingItem = this.cartItems.find(item => item.productId === productId);

                    if (existingItem) {
                        // Update existing cart item quantity
                        this.orderService.updateCartItemQuantity(productId, quantity);
                    } else {
                        // Add new item to cart
                        const orderItem: OrderItem = {
                            productId: product.id,
                            productName: product.name,
                            quantity: quantity,
                            price: product.price,
                            subtotal: product.price * quantity
                        };
                        this.orderService.addToCart(orderItem);
                    }
                    itemsUpdated++;
                }
            }
        });

        if (itemsUpdated > 0) {
            // Save the updated cart as draft on the server
            this.orderService.saveDraftCart().subscribe({
                next: draftOrder => {
                    // Optionally notify user
                    console.log('Draft saved', draftOrder);
                    // Clear bulk quantities after successful save
                    this.bulkQuantities.clear();
                },
                error: err => {
                    console.error('Failed to save draft cart:', err);
                    alert(this.translationService.instant('product.saveDraftFailed') || 'Failed to save cart draft');
                }
            });
        }
    }

    hasBulkItems(): boolean {
        return this.bulkQuantities.size > 0;
    }

    isInCart(productId: string): boolean {
        return this.cartItems.some(item => item.productId === productId);
    }

    getCartTotal(): number {
        return this.cartItems.reduce((total, item) => total + item.subtotal, 0);
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
            // Automatically update/add to cart
            const existingItem = this.cartItems.find(item => item.productId === productId);
            
            if (existingItem) {
                // Update existing cart item
                this.orderService.updateCartItemQuantity(productId, quantity);
            } else {
                // Add new item to cart
                const orderItem: OrderItem = {
                    productId: product.id,
                    productName: product.name,
                    quantity: quantity,
                    price: product.price,
                    subtotal: product.price * quantity
                };
                this.orderService.addToCart(orderItem);
            }
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
}
