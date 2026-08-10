const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./hesapmatik.db');

db.serialize(() => {
    db.run("CREATE INDEX IF NOT EXISTS idx_expenses_activityId ON expenses(activityId)");
    db.run("CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId)");
    db.run("CREATE INDEX IF NOT EXISTS idx_payments_activityId ON payments(activityId)");
    db.run("CREATE INDEX IF NOT EXISTS idx_payments_senderId ON payments(senderId)");
    db.run("CREATE INDEX IF NOT EXISTS idx_payments_receiverId ON payments(receiverId)");
    db.run("CREATE INDEX IF NOT EXISTS idx_activity_participants_activityId ON activity_participants(activityId)");
    db.run("CREATE INDEX IF NOT EXISTS idx_activity_participants_userId ON activity_participants(userId)");
    console.log("Indexes added successfully.");
});

db.close();
