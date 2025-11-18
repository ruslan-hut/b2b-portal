import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
    public translationService: TranslationService,
    private cdr: ChangeDetectorRef
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
        // Manually trigger change detection to ensure UI updates
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getStatusClass(status: OrderStatus): string {
    const statusClasses: { [key in OrderStatus]: string } = {
      [OrderStatus.DRAFT]: 'status-draft',
      [OrderStatus.NEW]: 'status-new',
      [OrderStatus.PROCESSING]: 'status-processing',
      [OrderStatus.CONFIRMED]: 'status-confirmed',
      [OrderStatus.CANCELLED]: 'status-cancelled'
    };
    return statusClasses[status] || 'status-new';
  }

  getTranslatedStatus(status: OrderStatus): string {
    const statusKeys: { [key in OrderStatus]: string } = {
      [OrderStatus.DRAFT]: 'orders.draft',
      [OrderStatus.NEW]: 'orders.new',
      [OrderStatus.PROCESSING]: 'orders.processing',
      [OrderStatus.CONFIRMED]: 'orders.confirmed',
      [OrderStatus.CANCELLED]: 'orders.cancelled'
    };
    const key = statusKeys[status] || 'orders.new';
    return this.translationService.instant(key);
  }

  viewOrderDetails(orderId: string): void {
    // TODO: Navigate to order details page when implemented
    console.log('View order details:', orderId);
  }

  navigateToCatalog(): void {
    this.router.navigate(['/products/catalog']);
  }
}
