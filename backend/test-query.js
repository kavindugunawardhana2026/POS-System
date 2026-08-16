const db = require('./config/db');
async function test() {
  try {
    await db.execute(`SELECT 
       COALESCE(SUM(total_amount), 0) AS total_sales,
       COUNT(invoice_id) AS total_orders
     FROM Invoices
     WHERE DATE(created_at, ?) = DATE('now', ?)
       AND status != 'cancelled' AND status != 'void' AND deleted_at IS NULL`, ['330 minutes', '330 minutes']);
    console.log("Success");
  } catch(e) {
    console.error(e.stack);
  }
}
test();
