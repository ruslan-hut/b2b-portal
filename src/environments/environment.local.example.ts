// Local development environment configuration
// Copy this file to environment.local.ts and customize for your local setup
// environment.local.ts is gitignored and will not be committed

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8888/api/v1', // Change this to your dev backend URL
  appTitle: 'B2B Portal (Local Dev)', // Optional: customize app title
  chatWsUrl: 'https://bot.darkbyrior.com/api/v1',
  chatWsToken: ''
};
