const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./hesapmatik.db', err => {
  if (err) {
    console.error('DB connection error:', err.message);
    process.exit(1);
  }
});

const deleteStmt = `DELETE FROM users WHERE username = ? OR email = ? OR phone = ?`;
const insertStmt = `INSERT INTO users (fullname, username, phone, email, password) VALUES (?, ?, ?, ?, ?)`;

db.serialize(() => {
  db.run(deleteStmt, ['sudisss', 'saadetsudegunes31@gmail.com', '05541898860'], function(err) {
    if (err) {
      console.error('Delete error:', err.message);
    } else {
      console.log('Deleted rows:', this.changes);
    }
    db.run(insertStmt, ['Test User', 'sudisss', '05541898860', 'saadetsudegunes31@gmail.com', 'test123'], function(err) {
      if (err) {
        console.error('Insert error:', err.message);
      } else {
        console.log('Inserted user with ID:', this.lastID);
      }
      db.close();
    });
  });
});
