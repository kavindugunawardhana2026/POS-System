'use strict';

const logger = require('../utils/logger');

/**
 * Global Express error handler.
 * Must have 4 parameters to be recognized as error middleware.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  logger.error(
    { err, method: req.method, url: req.originalUrl, user: req.user?.user_id },
    err.message
  );

  res.status(statusCode).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    message: err.isOperational ? err.message : 'Something went wrong',
    ...(err.details && { details: err.details }),
    ...(isDev && !err.isOperational && { stack: err.stack }),
  });
}

module.exports = errorHandler;
