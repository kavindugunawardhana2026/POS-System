'use strict';

const { z } = require('zod');

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  category_id: z.number().int().positive().optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  cost_price: z.number().nonnegative().default(0),
  retail_price: z.number().positive(),
  wholesale_price: z.number().positive().optional().nullable(),
  min_wholesale_quantity: z.number().positive().optional().nullable(),
  measurement_unit: z.enum(['kg','grams','units','liters','ml','pack']).default('units'),
  stock_quantity: z.number().nonnegative().default(0),
  low_stock_threshold: z.number().nonnegative().default(0),
  expiry_date: z.string().date().optional().nullable(),
});

const updateProductSchema = createProductSchema.partial();

module.exports = { createProductSchema, updateProductSchema };
