const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../hesapmatik.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Veritabanı hatası:', err.message);
    } else {
        console.log('SQLite veritabanına bağlandık!');

        db.run(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activityId INTEGER,
            expenseName TEXT,
            amount REAL,
            receipt TEXT,
            userId INTEGER
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activityName TEXT,
            activityPassword TEXT,
            coverImage TEXT,
            activityDate TEXT,
            creatorId INTEGER,
            isClosed INTEGER DEFAULT 0
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT,
            username TEXT UNIQUE,
            phone TEXT,
            email TEXT UNIQUE,
            password TEXT,
            reset_code TEXT,
            avatar TEXT,
            status TEXT DEFAULT 'active',
            panel_layout TEXT DEFAULT 'grid'
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS activity_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activityId INTEGER,
            userId INTEGER,
            FOREIGN KEY(activityId) REFERENCES activities(id),
            FOREIGN KEY(userId) REFERENCES users(id)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activityId INTEGER,
            senderId INTEGER,
            receiverId INTEGER,
            amount REAL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            createdAt TEXT,
            FOREIGN KEY(activityId) REFERENCES activities(id),
            FOREIGN KEY(senderId) REFERENCES users(id),
            FOREIGN KEY(receiverId) REFERENCES users(id)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            message TEXT,
            isRead INTEGER DEFAULT 0,
            createdAt TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )`);
        
        // Alter tables safely
        const alterQueries = [
            `ALTER TABLE activities ADD COLUMN creatorId INTEGER`,
            `ALTER TABLE expenses ADD COLUMN userId INTEGER`,
            `ALTER TABLE users ADD COLUMN avatar TEXT`,
            `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`,
            `ALTER TABLE activities ADD COLUMN isClosed INTEGER DEFAULT 0`,
            `ALTER TABLE users ADD COLUMN panel_layout TEXT DEFAULT 'grid'`
        ];

        alterQueries.forEach(query => {
            db.run(query, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Alter table error:', err.message);
                }
            });
        });
    }
});

module.exports = db;
