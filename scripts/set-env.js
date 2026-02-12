#!/usr/bin/env node

/**
 * Script to replace environment variables in Angular environment files and index.html
 * Usage: node scripts/set-env.js
 *
 * Environment variables:
 * - API_URL: Backend API URL (default: /api/v1)
 *   - Use relative path '/api/v1' for Docker deployment (same origin)
 *   - Use absolute URL 'https://api.domain.com/api/v1' for Nginx deployment (different origin)
 * - APP_TITLE: Application title (default: B2B Portal)
 *
 * Deployment Scenarios:
 * 1. Docker Monolith: API_URL=/api/v1 (backend serves frontend from ./static)
 * 2. Server + Nginx: API_URL=/api/v1 or absolute URL (Nginx proxies or different domain)
 */

const fs = require('fs');
const path = require('path');

// Get environment variables or use defaults
const apiUrl = process.env.API_URL || '/api/v1';  // Default to relative path for Docker
const appTitle = process.env.APP_TITLE || 'B2B Portal';
const chatWsToken = process.env.CHAT_WS_TOKEN || '';

console.log('========================================');
console.log('Setting Frontend Environment Variables');
console.log('========================================');
console.log(`API_URL: ${apiUrl}`);
console.log(`APP_TITLE: ${appTitle}`);
console.log(`CHAT_WS_TOKEN: ${chatWsToken ? '***SET***' : '(empty)'}`);

// Detect deployment scenario based on API_URL
const isRelativePath = apiUrl.startsWith('/');
const deploymentScenario = isRelativePath ? 'Same-origin (Docker or Nginx proxy)' : 'Cross-origin (Nginx different domain)';
console.log(`Deployment: ${deploymentScenario}`);
console.log('========================================');

// Path to environment file
const envFilePath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

// Read the environment file
let envContent = fs.readFileSync(envFilePath, 'utf8');

// Replace the apiUrl placeholder with actual value
envContent = envContent.replace(
  /apiUrl:\s*['"].*?['"]/,
  `apiUrl: '${apiUrl}'`
);

// Replace the chatWsToken placeholder with actual value
if (chatWsToken) {
  envContent = envContent.replace(
    /chatWsToken:\s*['"].*?['"]/,
    `chatWsToken: '${chatWsToken}'`
  );
}

// Write back to environment file
fs.writeFileSync(envFilePath, envContent, 'utf8');

// Update index.html with app title
const indexPath = path.join(__dirname, '..', 'src', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Replace the title tag
indexContent = indexContent.replace(
  /<title>.*?<\/title>/,
  `<title>${appTitle}</title>`
);

// Replace the apple-mobile-web-app-title meta tag
indexContent = indexContent.replace(
  /<meta name="apple-mobile-web-app-title" content=".*?">/,
  `<meta name="apple-mobile-web-app-title" content="${appTitle}">`
);

// Write back to index.html
fs.writeFileSync(indexPath, indexContent, 'utf8');

console.log('Environment variables set successfully!');
console.log(`Updated: ${envFilePath}`);
console.log(`Updated: ${indexPath}`);
