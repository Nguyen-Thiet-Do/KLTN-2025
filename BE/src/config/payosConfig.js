// src/config/payosConfig.js
require('dotenv').config();

module.exports = {
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  apiBase: (process.env.PAYOS_API_BASE || 'https://api-merchant.payos.vn').replace(/\/$/, ''),
  appBaseUrl: (process.env.APP_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
};
