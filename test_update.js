const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./hesapmatik.db');

const username = 'sudissss';

db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
  if (!row) { console.log('Kullanıcı bulunamadı'); return db.close(); }
  const userId = row.id;
  console.log('Silinecek userId:', userId, 'username:', username);

  db.serialize(() => {
    db.run("DELETE FROM activity_participants WHERE userId = ?", [userId]);
    db.run("DELETE FROM notifications WHERE userId = ?", [userId]);
    db.run("DELETE FROM expenses WHERE userId = ?", [userId]);
    db.run("DELETE FROM payments WHERE senderId = ? OR receiverId = ?", [userId, userId]);
    db.run("UPDATE activities SET creatorId = NULL WHERE creatorId = ?", [userId]);
    db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
      if (err) { console.error('Hata:', err); }
      else { console.log('Silinen satır sayısı:', this.changes); }
      db.all("SELECT id, username, status FROM users", (err, rows) => {
        console.log('Kalan kullanıcılar:', rows);
        db.close();
      });
    });
  });
});
