'use strict';

const { Router } = require('express');
const { login, loginPin, listCashiers, refresh, logout } = require('../../controllers/auth.controller');
const { authenticate } = require('../../middlewares/auth');
const { authLimiter } = require('../../middlewares/rateLimiter');
const validate = require('../../middlewares/validate');
const { loginSchema, pinLoginSchema } = require('../../validators/auth.validator');

const router = Router();

// Public
router.get('/cashiers',    listCashiers);                          // PIN screen cashier list
router.post('/login',      authLimiter, validate(loginSchema),    login);
router.post('/login-pin',  authLimiter, validate(pinLoginSchema), loginPin);
router.post('/refresh',    refresh);

// Authenticated
router.post('/logout', authenticate, logout);

module.exports = router;
