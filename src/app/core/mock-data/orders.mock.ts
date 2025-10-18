import { Order, OrderStatus } from '../models/order.model';

export const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    userId: '2',
    items: [
      {
        productId: '1',
        productName: 'Wireless Mouse Pro',
        quantity: 10,
        price: 49.99,
        subtotal: 499.90
      },
      {
        productId: '2',
        productName: 'Mechanical Keyboard',
        quantity: 5,
        price: 129.99,
        subtotal: 649.95
      }
    ],
    totalAmount: 1149.85,
    status: OrderStatus.DELIVERED,
    createdAt: new Date('2024-09-15T10:30:00'),
    updatedAt: new Date('2024-09-20T14:45:00'),
    shippingAddress: {
      street: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    }
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    userId: '2',
    items: [
      {
        productId: '11',
        productName: 'Ergonomic Office Chair',
        quantity: 15,
        price: 399.99,
        subtotal: 5999.85
      },
      {
        productId: '12',
        productName: 'Standing Desk',
        quantity: 10,
        price: 599.99,
        subtotal: 5999.90
      }
    ],
    totalAmount: 11999.75,
    status: OrderStatus.SHIPPED,
    createdAt: new Date('2024-10-01T09:15:00'),
    updatedAt: new Date('2024-10-05T11:20:00'),
    shippingAddress: {
      street: '456 Corporate Blvd',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA'
    }
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    userId: '2',
    items: [
      {
        productId: '6',
        productName: 'Premium Notebook Set',
        quantity: 50,
        price: 24.99,
        subtotal: 1249.50
      },
      {
        productId: '7',
        productName: 'Executive Pen Set',
        quantity: 25,
        price: 89.99,
        subtotal: 2249.75
      }
    ],
    totalAmount: 3499.25,
    status: OrderStatus.PROCESSING,
    createdAt: new Date('2024-10-10T14:22:00'),
    updatedAt: new Date('2024-10-12T08:30:00'),
    shippingAddress: {
      street: '789 Enterprise Dr',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA'
    }
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    userId: '2',
    items: [
      {
        productId: '3',
        productName: 'USB-C Hub',
        quantity: 20,
        price: 79.99,
        subtotal: 1599.80
      },
      {
        productId: '5',
        productName: 'Wireless Headset',
        quantity: 12,
        price: 199.99,
        subtotal: 2399.88
      }
    ],
    totalAmount: 3999.68,
    status: OrderStatus.CONFIRMED,
    createdAt: new Date('2024-10-14T16:45:00'),
    updatedAt: new Date('2024-10-14T17:00:00'),
    shippingAddress: {
      street: '321 Commerce St',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      country: 'USA'
    }
  },
  {
    id: '5',
    orderNumber: 'ORD-2024-005',
    userId: '2',
    items: [
      {
        productId: '13',
        productName: 'Filing Cabinet',
        quantity: 8,
        price: 249.99,
        subtotal: 1999.92
      }
    ],
    totalAmount: 1999.92,
    status: OrderStatus.PENDING,
    createdAt: new Date('2024-10-16T11:30:00'),
    updatedAt: new Date('2024-10-16T11:30:00'),
    shippingAddress: {
      street: '555 Industry Way',
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      country: 'USA'
    }
  },
  {
    id: '6',
    orderNumber: 'ORD-2024-006',
    userId: '3',
    items: [
      {
        productId: '8',
        productName: 'Desk Organizer',
        quantity: 30,
        price: 34.99,
        subtotal: 1049.70
      },
      {
        productId: '10',
        productName: 'Whiteboard Set',
        quantity: 5,
        price: 119.99,
        subtotal: 599.95
      }
    ],
    totalAmount: 1649.65,
    status: OrderStatus.DELIVERED,
    createdAt: new Date('2024-09-20T13:15:00'),
    updatedAt: new Date('2024-09-27T16:45:00'),
    shippingAddress: {
      street: '999 Demo Lane',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA'
    }
  }
];

