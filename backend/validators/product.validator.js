'use strict';

const { z } = require('zod');

/**
 * Allowed measurement units. We accept several UI-friendly spellings
 * (e.g. 'Units', 'Kg', 'Grams') but coerce them to the underlying ENUM.
 */
const MEASUREMENT_UNITS = [
  'kg', 'grams', 'units', 'liters', 'ml', 'pack',
  // Friendly aliases — normalized in the service layer.
  'unit', 'piece', 'pieces', 'pcs',
  'kilogram', 'kilograms', 'gram', 'litre', 'millilitre', 'milliliter', 'milliliters',
  'packet', 'packs',
];

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  category_id: z.number().int().positive().optional().nullable(),
  // SKU is optional — backend auto-generates if missing.
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  cost_price: z.number().nonnegative().default(0),
  retail_price: z.number().positive(),
  wholesale_price: z.number().positive().optional().nullable(),
  min_wholesale_quantity: z.number().positive().optional().nullable(),
  measurement_unit: z.enum(MEASUREMENT_UNITS).default('units'),
  stock_quantity: z.number().nonnegative().default(0),
  low_stock_threshold: z.number().nonnegative().default(0),
  expiry_date: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

const updateProductSchema = createProductSchema.partial();

module.exports = { createProductSchema, updateProductSchema };
