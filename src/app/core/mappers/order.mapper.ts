import { Order, OrderItem, BackendOrderRequest, BackendOrderResponse, ShippingAddress, OrderStatus } from '../models/order.model';

export class OrderMapper {
  /**
   * Generate a simple unique id fallback to avoid adding external deps in frontend code here.
   */
  private static generateUid(): string {
    return 'uid-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  }

  /**
   * Convert frontend order to backend format
   * NOTE: Backend calculates ALL monetary values (discount, VAT, subtotal, total_vat, total)
   * Frontend only sends: items with quantities, basic order info
   * This ensures consistent calculations across catalog, cart, and order history
   */
  static toBackendRequest(
    userId: string,
    items: OrderItem[],
    shippingAddress?: ShippingAddress,
    billingAddress?: ShippingAddress,
    comment?: string,
    status?: string, // CRM stage name or legacy status
    orderUid?: string // Optional UID for updating existing orders
  ): BackendOrderRequest {
    const uid = orderUid || this.generateUid();

    // Format address as string (empty string if not provided - for draft orders)
    const shippingAddressStr = shippingAddress ? this.formatAddress(shippingAddress) : '';
    const billingAddressStr = billingAddress ? this.formatAddress(billingAddress) : shippingAddressStr;

    // DO NOT calculate totals - backend calculates ALL monetary values
    // Send 0 as placeholder (backend validation allows omitempty, but 0 is safer)
    return {
      uid: uid,
      // Backend migrated from `user_uid` to `client_uid` — send client_uid to match API
      client_uid: userId,
      status: status || 'new', // Default to 'new' for backward compatibility
      total: 0, // Placeholder - backend will recalculate
      // DO NOT send discount_percent, vat_rate, subtotal, total_vat
      // Backend calculates these from client/store data
      shipping_address: shippingAddressStr,
      billing_address: billingAddressStr,
      comment: comment || undefined,
      items: items.map(item => {
        // Ensure price and subtotal are valid numbers (backend will recalculate anyway)
        const price = (item.price !== undefined && item.price !== null && !isNaN(item.price)) 
          ? Math.round(item.price * 100) 
          : 0; // Fallback to 0 if price is missing (backend will look it up)
        const subtotal = (item.subtotal !== undefined && item.subtotal !== null && !isNaN(item.subtotal))
          ? Math.round(item.subtotal * 100)
          : 0; // Fallback to 0 if subtotal is missing (backend will recalculate)
        
        return {
          order_uid: uid,
          product_uid: item.productId,
          quantity: item.quantity,
          price: price,
          discount: item.discount || 0, // Item discount (for reference only, backend recalculates)
          total: subtotal // Backend will recalculate
        };
      })
    } as BackendOrderRequest;
  }

  /**
   * Convert backend response to frontend order
   */
  static fromBackendResponse(response: BackendOrderResponse, items: any[]): Order {
    return {
      id: response.uid,
      orderNumber: this.generateOrderNumber(response.uid),
      number: response.number, // Optional order number from backend
      // Accept `client_uid` (new) or fallback to `user_uid` (older API)
      userId: (response as any).client_uid || (response as any).user_uid,
      items: items.map(item => ({
        sku: item.product_sku || '',
        barcode: item.barcode || '',
        productId: item.product_uid,
        productName: item.product_name || 'Unknown Product',
        quantity: item.quantity,
        price: (item.base_price || item.price) / 100, // Convert from cents
        priceWithVat: item.price_with_vat ? item.price_with_vat / 100 : undefined, // Price with VAT
        discount: item.discount, // Discount percentage
        priceDiscount: item.price_discount ? item.price_discount / 100 : undefined, // Price after discount without VAT
        priceAfterDiscountWithVat: item.price_after_discount_with_vat ? item.price_after_discount_with_vat / 100 : undefined, // Price after discount with VAT
        tax: item.tax ? item.tax / 100 : undefined, // VAT amount for this item
        subtotal: (item.subtotal || item.total) / 100 // Convert from cents (total with VAT)
      })),
      totalAmount: response.total / 100, // Convert from cents
      discountPercent: response.discount_percent, // Client discount percentage
      vatRate: response.vat_rate, // VAT rate percentage
      subtotal: response.subtotal ? response.subtotal / 100 : undefined, // Subtotal without VAT (in cents, convert to regular)
      totalVat: response.total_vat ? response.total_vat / 100 : undefined, // Total VAT amount (in cents, convert to regular)
      originalTotal: response.original_total ? response.original_total / 100 : undefined, // Original total before discount
      discountAmount: response.discount_amount ? response.discount_amount / 100 : undefined, // Total discount amount saved
      status: response.status, // Pass through status as-is (CRM stage name or legacy status)
      draft: response.draft ?? (response.status === 'draft'), // Use backend draft field, fallback to status check
      createdAt: new Date(response.created_at),
      // Backend may return `updated_at` or `last_update` depending on API version.
      // Prefer `last_update` if present, otherwise fall back to `updated_at` or `created_at`.
      updatedAt: new Date(response.last_update || response.updated_at || response.created_at),
      shippingAddress: this.parseAddress(response.shipping_address),
      // Individual address fields from backend
      countryCode: response.country_code,
      zipcode: response.zipcode,
      city: response.city,
      addressText: response.address_text,
      comment: response.comment
    };
  }

  /**
   * Format address object to string
   * Backend format: "addressText, city, zipcode, country"
   */
  private static formatAddress(address: ShippingAddress): string {
    return `${address.street}, ${address.city}, ${address.zipCode}, ${address.country}`;
  }

  /**
   * Parse address string to object
   * Backend format: "addressText, city, zipcode, country"
   */
  private static parseAddress(addressStr: string | undefined | null): ShippingAddress | undefined {
    // Handle undefined, null, or empty string
    if (!addressStr || addressStr.trim() === '') {
      return undefined;
    }

    // Parse backend format: addressText, city, zipcode, country
    const parts = addressStr.split(',').map(p => p.trim());
    return {
      street: parts[0] || '',
      city: parts[1] || '',
      state: '', // Not used in backend format
      zipCode: parts[2] || '',
      country: parts[3] || ''
    };
  }

  /**
   * @deprecated Status now passed through as-is from backend
   * Map backend status to frontend enum (kept for reference only)
   */
  private static mapBackendStatus(status: string): string {
    // No longer mapping - pass through status as received
    return status;
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
