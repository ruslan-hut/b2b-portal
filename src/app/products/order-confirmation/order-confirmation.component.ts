import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { OrderItem, CreateOrderRequest } from '../../core/models/order.model';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrl: './order-confirmation.component.scss'
})
export class OrderConfirmationComponent implements OnInit {
  cartItems: OrderItem[] = [];
  cartTotal = 0;
  shippingForm!: FormGroup;
  submitted = false;
  loading = false;
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartItems = this.orderService.getCartItems();
    this.cartTotal = this.orderService.getCartTotal();

    if (this.cartItems.length === 0) {
      this.router.navigate(['/products/catalog']);
      return;
    }

    this.shippingForm = this.formBuilder.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipCode: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      country: ['USA', Validators.required]
    });
  }

  get f() {
    return this.shippingForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.shippingForm.invalid) {
      return;
    }

    this.loading = true;

    const orderRequest: CreateOrderRequest = {
      items: this.cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      shippingAddress: this.shippingForm.value
    };

    this.orderService.createOrder(orderRequest).subscribe({
      next: (order) => {
        this.orderService.clearCart();
        this.loading = false;
        // Show success message or navigate to order details
        alert(`Order ${order.orderNumber} placed successfully!`);
        this.router.navigate(['/orders/history']);
      },
      error: (error) => {
        this.errorMessage = 'Failed to place order. Please try again.';
        this.loading = false;
      }
    });
  }

  cancelOrder(): void {
    this.router.navigate(['/products/catalog']);
  }

  removeItem(productId: string): void {
    this.orderService.removeFromCart(productId);
    this.cartItems = this.orderService.getCartItems();
    this.cartTotal = this.orderService.getCartTotal();

    if (this.cartItems.length === 0) {
      this.router.navigate(['/products/catalog']);
    }
  }
}
