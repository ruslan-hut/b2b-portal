import { Order, OrderItem, BackendOrderRequest, BackendOrderResponse, ShippingAddress, OrderStatus } from '../models/order.model';
import { v4 as uuidv4 } from 'uuid';

export class OrderMapper {
  /**
   * Convert frontend order to backend format
   */
  static toBackendRequest(
    userId: string,
    items: OrderItem[],
    shippingAddress: ShippingAddress,
    billingAddress?: ShippingAddress,
    comment?: string,
    status?: 'draft' | 'new', // Frontend can only use 'draft' or 'new'
    orderUid?: string // Optional UID for updating existing orders
  ): BackendOrderRequest {
    const uid = orderUid || uuidv4();

    // Calculate total in cents
    const total = items.reduce((sum, item) => sum + item.subtotal, 0) * 100;

    // Format address as string
    const shippingAddressStr = this.formatAddress(shippingAddress);
    const billingAddressStr = billingAddress ? this.formatAddress(billingAddress) : shippingAddressStr;

    return {
      uid: uid,
      user_uid: userId,
      status: status || 'new', // Default to 'new' for backward compatibility
      total: total,
      shipping_address: shippingAddressStr,
      billing_address: billingAddressStr,
      comment: comment || undefined,
      items: items.map(item => ({
        order_uid: uid,
        product_uid: item.productId,
        quantity: item.quantity,
        price: Math.round(item.price * 100), // Convert to cents
        discount: 0,
        total: Math.round(item.subtotal * 100) // Convert to cents
      }))
    };
  }

  /**
   * Convert backend response to frontend order
   */
  static fromBackendResponse(response: BackendOrderResponse, items: any[]): Order {
    return {
      id: response.uid,
      orderNumber: this.generateOrderNumber(response.uid),
      userId: response.user_uid,
      items: items.map(item => ({
        productId: item.product_uid,
        productName: item.product_name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price / 100, // Convert from cents
        subtotal: item.total / 100 // Convert from cents
      })),
      totalAmount: response.total / 100, // Convert from cents
      status: this.mapBackendStatus(response.status),
      createdAt: new Date(response.created_at),
      updatedAt: new Date(response.updated_at),
      shippingAddress: this.parseAddress(response.shipping_address),
      comment: response.comment
    };
  }

  /**
   * Format address object to string
   */
  private static formatAddress(address: ShippingAddress): string {
    return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
  }

  /**
   * Parse address string to object (basic implementation)
   */
  private static parseAddress(addressStr: string): ShippingAddress {
    // Basic parsing - adjust based on actual format
    const parts = addressStr.split(',').map(p => p.trim());
    return {
      street: parts[0] || '',
      city: parts[1] || '',
      state: parts[2]?.split(' ')[0] || '',
      zipCode: parts[2]?.split(' ')[1] || '',
      country: parts[3] || ''
    };
  }

  /**
   * Map backend status to frontend enum
   */
  private static mapBackendStatus(status: string): OrderStatus {
    const statusMap: { [key: string]: OrderStatus } = {
      'draft': OrderStatus.DRAFT,
      'new': OrderStatus.NEW,
      'processing': OrderStatus.PROCESSING,
      'confirmed': OrderStatus.CONFIRMED,
      'cancelled': OrderStatus.CANCELLED
    };
    return statusMap[status.toLowerCase()] || OrderStatus.NEW;
  }

  /**
   * Generate order number from UID
   */
  private static generateOrderNumber(uid: string): string {
    const year = new Date().getFullYear();
    const shortId = uid.substring(0, 8).toUpperCase();
    return `ORD-${year}-${shortId}`;
  }
}
