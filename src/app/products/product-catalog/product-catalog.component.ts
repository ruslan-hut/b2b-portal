import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { Product } from '../../core/models/product.model';
import { OrderItem } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';

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

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private router: Router,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.orderService.currentOrder$.subscribe(items => {
      this.cartItems = items;
    });

    // Subscribe to view mode changes from the service
    this.productService.viewMode$.subscribe(mode => {
      this.viewMode = mode;
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
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = this.sortProductsByCategoryAndName(products);
        this.extractAllCategories(products);
        this.filteredProducts = [...this.products];
        this.groupProductsByCategory(this.filteredProducts);
        this.loading = false;
        // Set first product as selected by default in bulk view
        if (this.filteredProducts.length > 0) {
          this.selectedProduct = this.filteredProducts[0];
        }
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
    let itemsUpdated = 0;
    
    // Process all products that have bulk quantities set
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
      this.bulkQuantities.clear();
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
}
