'use strict';

module.exports = {
  INVOICE: {
    DRAFT: 'draft',
    PAID: 'paid',
    PARTIAL: 'partial',
    UNPAID: 'unpaid',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
    CANCELLED: 'cancelled',
    VOID: 'void',
  },
  RETURN: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
  },
  SHIFT: {
    OPEN: 'open',
    CLOSED: 'closed',
  },
};
