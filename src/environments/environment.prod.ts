// This file will be modified during deployment by scripts/set-env.js
// The apiUrl will be replaced with the value from API_URL environment variable
// For monolith deployment, use relative path since frontend and backend are served from same domain
export const environment = {
  production: true,
  apiUrl: '/api/v1', // Relative path for monolith deployment
  appTitle: 'B2B Portal', // Default application title (can be overridden by APP_TITLE env var)
  chatWsUrl: 'https://bot.darkbyrior.com/api/v1',
  chatWsToken: ''
};
