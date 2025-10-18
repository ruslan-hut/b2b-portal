import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.scss'
})
export class OrderHistoryComponent implements OnInit {
  orders: Order[] = [];
  loading = false;
  OrderStatus = OrderStatus;

  constructor(
    private orderService: OrderService,
    private router: Router,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.getOrderHistory().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
      }
    });
  }

  getStatusClass(status: OrderStatus): string {
    const statusClasses: { [key in OrderStatus]: string } = {
      [OrderStatus.PENDING]: 'status-pending',
      [OrderStatus.CONFIRMED]: 'status-confirmed',
      [OrderStatus.PROCESSING]: 'status-processing',
      [OrderStatus.SHIPPED]: 'status-shipped',
      [OrderStatus.DELIVERED]: 'status-delivered',
      [OrderStatus.CANCELLED]: 'status-cancelled'
    };
    return statusClasses[status];
  }

  viewOrderDetails(orderId: string): void {
    // TODO: Navigate to order details page when implemented
    console.log('View order details:', orderId);
  }

  navigateToCatalog(): void {
    this.router.navigate(['/products/catalog']);
  }
}
