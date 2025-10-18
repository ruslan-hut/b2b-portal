import { Product, ProductCategory } from '../models/product.model';

export const MOCK_PRODUCTS: Product[] = [
  // Electronics
  {
    id: '1',
    name: 'Wireless Mouse Pro',
    description: 'Ergonomic wireless mouse with precision tracking and long battery life. Perfect for business use.',
    price: 49.99,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300x300/4A90E2/FFFFFF?text=Mouse',
    inStock: true,
    sku: 'ELEC-MOUSE-001'
  },
  {
    id: '2',
    name: 'Mechanical Keyboard',
    description: 'Professional mechanical keyboard with customizable RGB lighting and premium switches.',
    price: 129.99,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300x300/50C878/FFFFFF?text=Keyboard',
    inStock: true,
    sku: 'ELEC-KEY-002'
  },
  {
    id: '3',
    name: 'USB-C Hub',
    description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and power delivery.',
    price: 79.99,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300x300/E68A00/FFFFFF?text=USB+Hub',
    inStock: true,
    sku: 'ELEC-HUB-003'
  },
  {
    id: '4',
    name: 'Webcam 4K',
    description: '4K webcam with auto-focus and built-in microphone for professional video conferencing.',
    price: 159.99,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300x300/9B59B6/FFFFFF?text=Webcam',
    inStock: false,
    sku: 'ELEC-CAM-004'
  },
  {
    id: '5',
    name: 'Wireless Headset',
    description: 'Premium wireless headset with active noise cancellation and 30-hour battery life.',
    price: 199.99,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300x300/E74C3C/FFFFFF?text=Headset',
    inStock: true,
    sku: 'ELEC-HEAD-005'
  },

  // Office Supplies
  {
    id: '6',
    name: 'Premium Notebook Set',
    description: 'Set of 5 high-quality notebooks with 200 pages each, perfect for meetings and notes.',
    price: 24.99,
    category: 'Office Supplies',
    imageUrl: 'https://via.placeholder.com/300x300/3498DB/FFFFFF?text=Notebooks',
    inStock: true,
    sku: 'OFF-NOTE-006'
  },
  {
    id: '7',
    name: 'Executive Pen Set',
    description: 'Luxury pen set with ballpoint and rollerball pens in premium gift box.',
    price: 89.99,
    category: 'Office Supplies',
    imageUrl: 'https://via.placeholder.com/300x300/2C3E50/FFFFFF?text=Pen+Set',
    inStock: true,
    sku: 'OFF-PEN-007'
  },
  {
    id: '8',
    name: 'Desk Organizer',
    description: 'Bamboo desk organizer with multiple compartments for office supplies.',
    price: 34.99,
    category: 'Office Supplies',
    imageUrl: 'https://via.placeholder.com/300x300/95A5A6/FFFFFF?text=Organizer',
    inStock: true,
    sku: 'OFF-ORG-008'
  },
  {
    id: '9',
    name: 'Paper Shredder',
    description: 'Cross-cut paper shredder with 12-sheet capacity and auto-feed feature.',
    price: 149.99,
    category: 'Office Supplies',
    imageUrl: 'https://via.placeholder.com/300x300/7F8C8D/FFFFFF?text=Shredder',
    inStock: false,
    sku: 'OFF-SHRED-009'
  },
  {
    id: '10',
    name: 'Whiteboard Set',
    description: 'Magnetic whiteboard with markers, eraser, and mounting hardware. 48x36 inches.',
    price: 119.99,
    category: 'Office Supplies',
    imageUrl: 'https://via.placeholder.com/300x300/ECF0F1/000000?text=Whiteboard',
    inStock: true,
    sku: 'OFF-BOARD-010'
  },

  // Furniture
  {
    id: '11',
    name: 'Ergonomic Office Chair',
    description: 'Premium ergonomic chair with lumbar support, adjustable armrests, and breathable mesh.',
    price: 399.99,
    category: 'Furniture',
    imageUrl: 'https://via.placeholder.com/300x300/34495E/FFFFFF?text=Chair',
    inStock: true,
    sku: 'FURN-CHAIR-011'
  },
  {
    id: '12',
    name: 'Standing Desk',
    description: 'Electric height-adjustable standing desk with memory presets. 60x30 inches.',
    price: 599.99,
    category: 'Furniture',
    imageUrl: 'https://via.placeholder.com/300x300/16A085/FFFFFF?text=Desk',
    inStock: true,
    sku: 'FURN-DESK-012'
  },
  {
    id: '13',
    name: 'Filing Cabinet',
    description: '3-drawer steel filing cabinet with lock. Holds letter and legal size documents.',
    price: 249.99,
    category: 'Furniture',
    imageUrl: 'https://via.placeholder.com/300x300/BDC3C7/FFFFFF?text=Cabinet',
    inStock: true,
    sku: 'FURN-CAB-013'
  },
  {
    id: '14',
    name: 'Bookshelf Unit',
    description: '5-tier wooden bookshelf with adjustable shelves. Modern design.',
    price: 179.99,
    category: 'Furniture',
    imageUrl: 'https://via.placeholder.com/300x300/8E44AD/FFFFFF?text=Bookshelf',
    inStock: true,
    sku: 'FURN-SHELF-014'
  },
  {
    id: '15',
    name: 'Conference Table',
    description: 'Large conference table seats 8-10 people. Includes cable management.',
    price: 899.99,
    category: 'Furniture',
    imageUrl: 'https://via.placeholder.com/300x300/2C3E50/FFFFFF?text=Table',
    inStock: false,
    sku: 'FURN-TABLE-015'
  }
];

export const MOCK_CATEGORIES: ProductCategory[] = [
  { id: '1', name: 'Electronics' },
  { id: '2', name: 'Office Supplies' },
  { id: '3', name: 'Furniture' }
];

