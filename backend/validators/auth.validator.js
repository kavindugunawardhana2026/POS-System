'use strict';

const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const pinLoginSchema = z.object({
  user_id: z.number().int().positive('User ID required'),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
});

module.exports = { loginSchema, pinLoginSchema };
