'use strict';

const db = require('../config/db');

function dateClause(from, to, alias = 'i') {
  const params = [];
  let clause = '';
  if (from) { clause += ` AND DATE(${alias}.created_at) >= ?`; params.push(from); }
  if (to)   { clause += ` AND DATE(${alias}.created_at) <= ?`; params.push(to); }
  return { clause, params };
}

async function salesSummary({ from, to } = {}) {
  const { clause, params } = dateClause(from, to);

  const [[summary]] = await db.execute(
    `SELECT
       COUNT(*)                                                    AS invoice_count,
       COALESCE(SUM(total_amount),  0)                            AS total_revenue,
       COALESCE(SUM(discount),      0)                            AS total_discount,
       COALESCE(AVG(total_amount),  0)                            AS avg_order_value,
       COALESCE(SUM(IF(status='paid',     1, 0)), 0)              AS paid_count,
       COALESCE(SUM(IF(status='unpaid',   1, 0)), 0)              AS unpaid_count,
       COALESCE(SUM(IF(status='partial',  1, 0)), 0)              AS partial_count,
       COALESCE(SUM(IF(status NOT IN ('cancelled','void','draft'),paid_amount, 0)), 0) AS total_collected
     FROM Invoices i
     WHERE deleted_at IS NULL
       AND status NOT IN ('cancelled','void','draft')
       ${clause}`,
    params
  );

  return summary;
}

async function topProducts({ from, to, limit = 10 } = {}) {
  const { clause, params } = dateClause(from, to);

  const [rows] = await db.execute(
    `SELECT
       p.name, p.sku,
       SUM(ii.quantity)                   AS qty_sold,
       COALESCE(SUM(ii.subtotal), 0)      AS revenue
     FROM Invoice_Items ii
     JOIN Invoices i  ON i.invoice_id  = ii.invoice_id
     JOIN Products p  ON p.product_id  = ii.product_id
     WHERE i.deleted_at IS NULL
       AND i.status NOT IN ('cancelled','void','draft')
       ${clause}
     GROUP BY ii.product_id, p.name, p.sku
     ORDER BY qty_sold DESC
     LIMIT ${Number(limit)}`,
    params
  );

  return rows;
}

async function salesByPeriod({ from, to, group_by = 'day' } = {}) {
  const { clause, params } = dateClause(from, to);
  const period = group_by === 'month'
    ? `DATE_FORMAT(i.created_at, '%Y-%m')`
    : `DATE(i.created_at)`;

  const [rows] = await db.execute(
    `SELECT
       ${period}                       AS period,
       COUNT(*)                        AS invoice_count,
       COALESCE(SUM(total_amount), 0)  AS revenue
     FROM Invoices i
     WHERE deleted_at IS NULL
       AND status NOT IN ('cancelled','void','draft')
       ${clause}
     GROUP BY period
     ORDER BY period ASC`,
    params
  );

  return rows;
}

async function paymentMethods({ from, to } = {}) {
  const { clause, params } = dateClause(from, to);

  const [rows] = await db.execute(
    `SELECT
       ip.payment_method,
       COUNT(*)                      AS count,
       COALESCE(SUM(ip.amount), 0)   AS total
     FROM Invoice_Payments ip
     JOIN Invoices i ON i.invoice_id = ip.invoice_id
     WHERE i.deleted_at IS NULL
       AND i.status NOT IN ('cancelled','void','draft')
       ${clause}
     GROUP BY ip.payment_method
     ORDER BY total DESC`,
    params
  );

  return rows;
}

module.exports = { salesSummary, topProducts, salesByPeriod, paymentMethods };
