const Database = require('better-sqlite3');
const db = new Database('data/positiq_dev.db');
try {
  const stmt = db.prepare("SELECT DATE('now', ?) as test");
  console.log(stmt.get('-7 days'));
} catch(e) {
  console.error("ERROR:", e.message);
}
