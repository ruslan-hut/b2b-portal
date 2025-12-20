import { User } from '../models/user.model';

export const MOCK_USERS: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    name: 'John Admin',
    companyName: 'TechCorp Solutions',
    role: 'admin'
  },
  {
    id: '2',
    email: 'client@example.com',
    name: 'Jane Smith',
    companyName: 'ABC Retail Inc',
    role: 'client'
  },
  {
    id: '3',
    email: 'demo@example.com',
    name: 'Demo User',
    companyName: 'Demo Company',
    role: 'client'
  }
];

// For testing: any email/password combination will work in mock mode
// The user returned will be based on the email entered
export const MOCK_CREDENTIALS = {
  admin: {
    email: 'admin@example.com',
    password: 'admin123',
    description: 'Admin user with full access'
  },
  client: {
    email: 'client@example.com',
    password: 'client123',
    description: 'Regular client user'
  },
  demo: {
    email: 'demo@example.com',
    password: 'demo123',
    description: 'Demo user for testing'
  }
};

