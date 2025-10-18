import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { Product } from '../../core/models/product.model';
import { OrderItem } from '../../core/models/order.model';

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

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private router: Router
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
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = products;
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

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.filteredProducts = this.products;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredProducts = this.products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query)
    );
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
}
