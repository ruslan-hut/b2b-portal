// This file will be modified during deployment by scripts/set-env.js
// The apiUrl will be replaced with the value from API_URL environment variable
export const environment = {
  production: true,
  apiUrl: 'http://localhost:8080/api/v1' // Will be replaced during CI/CD
};
