'use strict';

const { z } = require('zod');

const invoiceItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().positive(),
  unit_price: z.number().positive().optional(),
  discount: z.number().nonnegative().default(0),
});

const paymentSchema = z.object({
  payment_method: z.enum(['cash','card','upi','wallet','bank_transfer','credit','cheque']),
  amount: z.number().positive(),
  reference_no: z.string().optional().nullable(),
});

const createInvoiceSchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  shift_id: z.number().int().positive().optional().nullable(),
  sale_type: z.enum(['retail','wholesale']).default('retail'),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  credit_note_number: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1),
  payments: z.array(paymentSchema).optional(),
});

module.exports = { createInvoiceSchema };
