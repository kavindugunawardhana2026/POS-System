'use strict';

const { ValidationError } = require('../errors/HttpErrors');

/**
 * Middleware factory to validate req.body against a Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }
    req.body = result.data; // use coerced/stripped data
    next();
  };
}

module.exports = validate;
