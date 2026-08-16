const db = require('./config/db');

async function test() {
  try {
    const [rows] = await db.execute('SELECT invoice_id, total_amount, created_at, status FROM Invoices ORDER BY created_at DESC LIMIT 5');
    console.log("Invoices:", rows);
    
    const [metrics] = await db.execute('SELECT NOW() as current_time_db');
    console.log("DB NOW():", metrics[0]);
    
    console.log("JS new Date():", new Date());
    console.log("JS offsetMinutes:", -new Date().getTimezoneOffset());
    
    const offsetMinutes = -new Date().getTimezoneOffset();
    const [[sales]] = await db.execute(
      `SELECT 
         COALESCE(SUM(total_amount), 0) AS total_sales,
         COUNT(invoice_id) AS total_orders
       FROM Invoices
       WHERE DATE(DATE_ADD(created_at, INTERVAL ? MINUTE)) = DATE(DATE_ADD(NOW(), INTERVAL ? MINUTE))
         AND status != 'cancelled' AND status != 'void' AND deleted_at IS NULL`,
      [offsetMinutes, offsetMinutes]
    );
    console.log("Dashboard Today query result:", sales);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
