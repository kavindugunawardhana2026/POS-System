'use strict';

const db = require('../config/db');

async function getMetrics() {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Sales and orders today
  const [[sales]] = await db.execute(
    `SELECT 
       COALESCE(SUM(total_amount), 0) AS total_sales,
       COUNT(invoice_id) AS total_orders
     FROM Invoices
     WHERE DATE(created_at) = ? AND status != 'cancelled' AND status != 'void' AND deleted_at IS NULL`,
    [todayStr]
  );

  // Returns today
  const [[returns]] = await db.execute(
    `SELECT COUNT(return_id) AS total_returns
     FROM Returns
     WHERE DATE(created_at) = ?`,
    [todayStr]
  );

  // Customers (all time, but we can return total for metric)
  const [[customers]] = await db.execute(
    `SELECT COUNT(customer_id) AS total_customers FROM Customers WHERE deleted_at IS NULL`
  );

  return {
    todaySales: Number(sales.total_sales),
    todayOrders: Number(sales.total_orders),
    todayReturns: Number(returns.total_returns),
    totalCustomers: Number(customers.total_customers)
  };
}

async function getSalesTrend(days = 7) {
  // Returns last N days of sales grouped by date
  // Using an inline query to get the last X days, assuming there's data on those days.
  // For a more robust approach in MySQL 8+, a recursive CTE could generate the dates.
  // We'll just group existing invoice dates over the last N days.
  
  const [rows] = await db.execute(
    `SELECT 
       DATE(created_at) as date, 
       SUM(total_amount) as sales,
       COUNT(invoice_id) as orders
     FROM Invoices
     WHERE created_at >= DATE(NOW() - INTERVAL ? DAY)
       AND status != 'cancelled' AND status != 'void' AND deleted_at IS NULL
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [days]
  );

  return rows.map(r => ({
    date: r.date.toISOString().slice(0, 10),
    sales: Number(r.sales),
    orders: Number(r.orders)
  }));
}

async function getLowStock(limit = 10) {
  // Get products where stock <= low_stock_threshold (and low_stock_threshold > 0, to avoid flagging everything if threshold is 0)
  // Actually, we should flag if stock <= threshold even if threshold is 0, but only if we want them alerted.
  // We will just do stock <= threshold and active.
  const [rows] = await db.execute(
    `SELECT product_id, sku, name, stock_quantity, low_stock_threshold
     FROM Products
     WHERE is_active = 1 AND deleted_at IS NULL 
       AND stock_quantity <= low_stock_threshold
       AND low_stock_threshold > 0
     ORDER BY (stock_quantity - low_stock_threshold) ASC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
}

async function getRecentTransactions(limit = 5) {
  const [rows] = await db.execute(
    `SELECT i.invoice_id, i.invoice_number, i.total_amount, i.status, i.created_at,
            c.name as customer_name
     FROM Invoices i
     LEFT JOIN Customers c ON i.customer_id = c.customer_id
     WHERE i.deleted_at IS NULL
     ORDER BY i.created_at DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
}

module.exports = {
  getMetrics,
  getSalesTrend,
  getLowStock,
  getRecentTransactions
};
