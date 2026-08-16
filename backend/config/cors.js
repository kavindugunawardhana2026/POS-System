'use strict';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev
  'http://localhost:5488', // Electron dev backend
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5488',
  // Electron renderer (production build loaded via file://)
  // Origin is null for file:// — handled by !origin check below
];

module.exports = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy blocked origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
