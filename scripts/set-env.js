#!/usr/bin/env node

/**
 * Script to replace environment variables in Angular environment files
 * Usage: node scripts/set-env.js
 *
 * Environment variables:
 * - API_URL: Backend API URL (default: http://localhost:8080/api/v1)
 */

const fs = require('fs');
const path = require('path');

// Get API URL from environment variable or use default
const apiUrl = process.env.API_URL || 'http://localhost:8080/api/v1';

console.log('Setting environment variables...');
console.log(`API_URL: ${apiUrl}`);

// Path to environment file
const envFilePath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

// Read the environment file
let envContent = fs.readFileSync(envFilePath, 'utf8');

// Replace the apiUrl placeholder with actual value
envContent = envContent.replace(
  /apiUrl:\s*['"].*?['"]/,
  `apiUrl: '${apiUrl}'`
);

// Write back to file
fs.writeFileSync(envFilePath, envContent, 'utf8');

console.log('Environment variables set successfully!');
console.log(`Updated: ${envFilePath}`);
