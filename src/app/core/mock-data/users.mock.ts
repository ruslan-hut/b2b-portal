import { User } from '../models/user.model';

export const MOCK_USERS: User[] = [
  {
    uid: '1',
    username: 'admin',
    email: 'admin@example.com',
    first_name: 'John',
    last_name: 'Admin',
    role: 'admin'
  },
  {
    uid: '2',
    username: 'client',
    email: 'client@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'client'
  },
  {
    uid: '3',
    username: 'demo',
    email: 'demo@example.com',
    first_name: 'Demo',
    last_name: 'User',
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

