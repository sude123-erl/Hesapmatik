require('dotenv').config();
const fs = require('fs');
const nodemailer = require('nodemailer');
const express = require('express');
const path = require('path');
const multer = require('multer');
const os = require('os');
const session = require('express-session');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 2024;

// Render arkasındaki HTTPS proxy desteği
app.set('trust proxy', 1);

// Veritabanı URL veya dosya yolu tespiti (Render Environment Variables desteği)
const dbUrlOrPath = process.env.DATABASE_URL || 
                    process.env.TURSO_DATABASE_URL || 
                    process.env.LIBSQL_URL || 
                    process.env.DB_URL || 
                    process.env.DB_PATH;

let dbPath;

if (dbUrlOrPath) {
    dbPath = dbUrlOrPath;
} else {
    // Kalıcı veri saklama dizini tespiti (Render Persistent Disk veya varsayılan yerel dizin)
    let dataDir = process.env.DATA_DIR || (process.env.RENDER ? '/var/data' : path.join(__dirname, 'data'));

    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
        } catch (e) {
            console.warn(`'${dataDir}' dizini oluşturulamadı (${e.message}). Güvenli yerel dizine geçiliyor.`);
            dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
        }
    }
    dbPath = path.join(dataDir, 'hesapmatik.db');
}

// Uzak veritabanı URL'si mi yoksa yerel SQLite dosya yolu mu tespiti
const isRemoteDb = typeof dbPath === 'string' && (
    dbPath.startsWith('libsql:') ||
    dbPath.startsWith('http:') ||
    dbPath.startsWith('https:') ||
    dbPath.startsWith('ws:') ||
    dbPath.startsWith('wss:')
);

let sqlite3;
if (isRemoteDb) {
    try {
        sqlite3 = require('@libsql/sqlite3').verbose();
    } catch (e) {
        sqlite3 = require('sqlite3').verbose();
    }
} else {
    sqlite3 = require('sqlite3').verbose();
}

// Uploads dizini ayarı
let uploadsDir;
if (process.env.DATA_DIR || process.env.RENDER) {
    let baseDataDir = process.env.DATA_DIR || '/var/data';
    if (!fs.existsSync(baseDataDir)) {
        try {
            fs.mkdirSync(baseDataDir, { recursive: true });
            uploadsDir = path.join(baseDataDir, 'uploads');
        } catch (e) {
            uploadsDir = path.join(__dirname, 'uploads');
        }
    } else {
        uploadsDir = path.join(baseDataDir, 'uploads');
    }
} else {
    uploadsDir = path.join(__dirname, 'uploads');
}

if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (e) {
        uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
    }
}

const upload = multer({ dest: uploadsDir });

function getLocalNetworkIp() {
    const networks = os.networkInterfaces();
    for (const entries of Object.values(networks)) {
        for (const network of entries || []) {
            if (network.family === 'IPv4' && !network.internal && network.address !== '127.0.0.1') {
                return network.address;
            }
        }
    }
    return null;
}

const localNetworkIp = getLocalNetworkIp();

app.use(session({
    secret: process.env.SESSION_SECRET || 'gizli-anahtar-kelime-degisti',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 gün boyunca oturumu koru
    }
}));

// E-posta gönderici ayarları (Gmail SMTP)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER || 'saadetsudegunes31.@gmail.com',
        pass: process.env.SMTP_PASS || 'ycprxvmvcoagxveb'
    }
});

// Form verilerini okuyabilmek için middleware ayarları
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Veritabanı bağlantısı ve tablolar
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Veritabanı hatası:', err.message);
    } else {
        console.log(`SQLite / LibSQL veritabanına bağlandık: ${dbPath}`);

        db.serialize(() => {
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
            db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                feedbackType TEXT,
                message TEXT,
                contactInfo TEXT,
                createdAt TEXT
            )`, () => {
                const alterQueries = [
                    `ALTER TABLE activities ADD COLUMN creatorId INTEGER`,
                    `ALTER TABLE expenses ADD COLUMN userId INTEGER`,
                    `ALTER TABLE users ADD COLUMN avatar TEXT`,
                    `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`,
                    `ALTER TABLE activities ADD COLUMN isClosed INTEGER DEFAULT 0`,
                    `ALTER TABLE users ADD COLUMN panel_layout TEXT DEFAULT 'grid'`
                ];
                alterQueries.forEach(query => {
                    db.run(query, () => {});
                });
            });
        });
    }
});

// Ana Sayfa
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
    }
    return res.redirect('/login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { fullname, username, phone, email, password } = req.body;
    const cleanUsername = username ? username.trim() : '';
    const cleanEmail = email ? email.trim() : '';
    const cleanPhone = phone ? phone.trim() : '';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (fullname, username, phone, email, password) VALUES (?, ?, ?, ?, ?)`;

        db.run(query, [fullname, cleanUsername, cleanPhone, cleanEmail, hashedPassword], function (err) {
            if (err) {
                console.error('Kayıt hatası:', err.message);
                return res.send('Bu kullanıcı adı veya e-posta zaten kayıtlı! <a href="/register">Tekrar Dene</a>');
            }
            console.log('Yeni Kullanıcı Oluşturuldu ID:', this.lastID);
            res.redirect('/login');
        });
    } catch (error) {
        console.error('Şifreleme hatası:', error);
        res.status(500).send('Kayıt sırasında bir hata oluştu.');
    }
});

// Giriş Sayfası ve İşlemi (Kullanıcı adı, e-posta veya telefon ile giriş desteği)
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Çıkış yapılırken hata oluştu:", err);
        res.redirect('/login?logout=success');
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        passive: req.query.passive === '1',
        reactivateStep: req.query.step || null,  // 'email' veya 'otp'
        reactivateError: req.query.err || null,
        reactivateSuccess: req.query.success === '1',
        logoutSuccess: req.query.logout === 'success'
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const cleanInput = username ? username.trim() : '';

    const query = `SELECT * FROM users WHERE (username = ? OR email = ? OR phone = ?)`;

    db.get(query, [cleanInput, cleanInput, cleanInput], async (err, row) => {
        if (err) {
            console.error('Giriş hatası:', err.message);
            return res.send('Bir hata oluştu!');
        }

        if (row) {
            let passwordMatch = false;
            if (row.password && (row.password.startsWith('$2a$') || row.password.startsWith('$2b$') || row.password.startsWith('$2y$'))) {
                passwordMatch = await bcrypt.compare(password, row.password);
            } else {
                passwordMatch = (password === row.password);
            }

            if (passwordMatch) {
                const userStatus = row.status ? row.status.toString().trim().toLowerCase() : '';


                if (userStatus === 'passive') {
                    return res.redirect('/login?err=passive_wrong');
                }

                req.session.userId = row.id;
                req.session.user = row;

                const returnTo = req.session.returnTo;
                delete req.session.returnTo;

                if (returnTo && /^\/join\/\d+$/.test(returnTo)) {
                    return res.redirect(returnTo);
                }
                return res.redirect('/dashboard');
            }

            // Kullanıcı var ama şifre yanlış, hesap pasif mi kontrol edelim
            const userStatus = row.status ? row.status.toString().trim().toLowerCase() : '';
            if (userStatus === 'passive') {
                return res.redirect('/login?err=passive_wrong');
            }
        }

        // Şifre yanlış veya kullanıcı yok.
        return res.redirect('/login?err=wrong');
    });
});

// Hesap aktivasyonu - E-posta ile OTP gönder
app.post('/reactivate', (req, res) => {
    const { email } = req.body;
    if (!email) return res.redirect('/login?passive=1&err=no_email');

    db.get('SELECT * FROM users WHERE email = ? AND status = \'passive\'', [email.trim()], (err, user) => {
        if (err || !user) {
            return res.redirect('/login?passive=1&err=email_not_found');
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.reactivateOtp = { code: otpCode, userId: user.id, email: user.email };

        // E-posta gönder
        const mailOptions = {
            from: 'saadetsudegunes31.@gmail.com',
            to: user.email,
            subject: 'Hesap Aktivasyon Kodu - Hesapmatik',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f9fafb; border-radius: 12px;">
                    <h2 style="color: #059669; margin-bottom: 20px;">Hesap Aktivasyonu</h2>
                    <p style="color: #374151;">Hesabınızı aktifleştirmek için aşağıdaki 6 haneli kodu girin:</p>
                    <div style="background: #065f46; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 8px;">
                        ${otpCode}
                    </div>
                    <p style="color: #6b7280; font-size: 13px;">Bu kodu kimseyle paylaşmayın. Geçerlilik süresi 10 dakikadır.</p>
                </div>
            `
        };

        console.log('Aktivasyon OTP kodu:', otpCode);

        transporter.sendMail(mailOptions, (mailErr) => {
            if (mailErr) {
                console.error('Mail gönderilemedi:', mailErr);
            }
        });

        res.redirect('/login?step=otp&email=' + encodeURIComponent(user.email));
    });
});

// Hesap aktivasyonu - OTP doğrula ve aktifleştir
app.post('/reactivate/verify', (req, res) => {
    const { otpInput } = req.body;
    const pending = req.session.reactivateOtp;

    if (!pending) return res.redirect('/login?passive=1');
    if (!otpInput || otpInput.trim() !== pending.code) {
        return res.redirect('/login?step=otp&email=' + encodeURIComponent(pending.email) + '&err=wrong_otp');
    }

    db.run("UPDATE users SET status = 'active' WHERE id = ?", [pending.userId], function (err) {
        if (err) {
            console.error('Aktivasyon hatası:', err);
            return res.redirect('/login?passive=1&err=db_error');
        }

        // Session'daki OTP'yi temizle
        delete req.session.reactivateOtp;

        // Kullanıcıyı otomatik giriş yapmayı iptal ediyoruz, yeniden giriş yapması için logine gönderiyoruz
        res.redirect('/login?success=1');
    });
});

const activitiesForUserQuery = `
    SELECT DISTINCT activities.*
    FROM activities
    LEFT JOIN activity_participants ON activity_participants.activityId = activities.id
    WHERE activities.creatorId = ? OR activity_participants.userId = ?
    ORDER BY activities.id DESC
`;

// Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }

    const currentUserId = req.session.userId;

    db.get(`SELECT * FROM users WHERE id = ?`, [currentUserId], (err, dbUser) => {
        if (err || !dbUser) {
            dbUser = req.session.user;
        }

        db.all(activitiesForUserQuery, [currentUserId, currentUserId], (err, activities) => {
            if (err) {
                console.error("Dashboard etkinlik hatası:", err.message);
                activities = [];
            }

            // Split activities into active and closed
            const activeActivities = (activities || []).filter(a => a.isClosed === null || a.isClosed === undefined || Number(a.isClosed) < 2);
            const pastActivities = (activities || []).filter(a => Number(a.isClosed) === 2);

            const paymentQuery = `
                SELECT payments.*, 
                       sender.username as senderName, 
                       receiver.username as receiverName 
                FROM payments 
                JOIN users sender ON payments.senderId = sender.id 
                JOIN users receiver ON payments.receiverId = receiver.id 
                WHERE payments.senderId = ? OR payments.receiverId = ?
            `;

            db.all(paymentQuery, [currentUserId, currentUserId], (paymentErr, payments) => {
                if (paymentErr) {
                    payments = [];
                }

                res.render('dashboard', {
                    user: dbUser,
                    currentUser: dbUser,
                    activities: activeActivities,
                    pastActivities: pastActivities,
                    payments: payments
                });
            });
        });
    });
});

// Şifremi Unuttum İşlemleri
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (!user) {
            return res.send('Bu e-posta adresine kayıtlı kullanıcı bulunamadı! <a href="/forgot-password">Geri dön</a>');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        db.run(`UPDATE users SET reset_code = ? WHERE email = ?`, [code, email], (err) => {
            if (err) {
                return res.send('Bir hata oluştu.');
            }

            const mailOptions = {
                from: 'saadetsudegunes31.@gmail.com',
                to: email,
                subject: 'Hesapmatik - Şifre Sıfırlama Kodu',
                text: `Şifre sıfırlama kodun: ${code}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Mail gönderme hatası:', error);
                    return res.send('Gmail Hatası: ' + error.message);
                }
                res.render('reset-password');
            });
        });
    });
});

app.get('/reset-password', (req, res) => {
    res.render('reset-password');
});

app.post('/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;

    db.get(`SELECT * FROM users WHERE email = ? AND reset_code = ?`, [email, code], (err, user) => {
        if (!user) {
            return res.send('Kod hatalı veya e-posta yanlış! <a href="/forgot-password">Tekrar dene</a>');
        }

        db.run(`UPDATE users SET password = ?, reset_code = NULL WHERE email = ?`, [newPassword, email], (err) => {
            if (err) {
                return res.send('Şifre güncellenirken hata oluştu.');
            }
            res.render('login', { successMessage: 'Şifren başarıyla değiştirildi! Yeni şifrenle giriş yapabilirsin.' });
        });
    });
});

// Yeni Etkinlik Oluşturma Sayfası
app.get('/create-activity', (req, res) => {
    res.render('create');
});

app.post('/create-activity', upload.single('coverImage'), (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    const { activityName, activityPassword, activityDate } = req.body;
    const coverImage = req.file ? '/uploads/' + req.file.filename : null;
    const query = `INSERT INTO activities (activityName, activityPassword, activityDate, coverImage, creatorId) VALUES (?, ?, ?, ?, ?)`;

    db.run(query, [activityName, activityPassword, activityDate, coverImage, req.session.userId], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Veritabanına kaydedilirken hata oluştu.");
        }
        db.run(`INSERT OR IGNORE INTO activity_participants (activityId, userId) VALUES (?, ?)`, [this.lastID, req.session.userId]);
        res.redirect('/panel?success=true');
    });
});

// Etkinlik Detay Sayfası
app.get('/activity/:id', (req, res) => {
    const activityId = req.params.id;
    const currentUserId = req.session.userId;

    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) {
            return res.status(404).send("Etkinlik bulunamadı.");
        }

        // Etkinlik harcamalara kapatılmışsa (mahsuplaşma aşamasındaysa veya tamamen kapalıysa) direkt mahsuplaşma sayfasına yönlendir
        if (activity && Number(activity.isClosed) >= 1) {
            return res.redirect(`/settlement/${activityId}`);
        }

        db.all(`SELECT * FROM expenses WHERE activityId = ? AND userId = ?`, [activityId, currentUserId], (err, expenses) => {
            if (err) expenses = [];

            const paymentsQuery = `
                SELECT payments.*, 
                       sender.fullname AS senderName, sender.username AS senderUsername,
                       receiver.fullname AS receiverName, receiver.username AS receiverUsername
                FROM payments
                JOIN users sender ON payments.senderId = sender.id
                JOIN users receiver ON payments.receiverId = receiver.id
                WHERE payments.activityId = ?
                ORDER BY payments.id DESC
            `;
            db.all(paymentsQuery, [activityId], (err, payments) => {
                if (err) payments = [];

                const participantsQuery = `
                    SELECT users.id, users.fullname, users.username
                    FROM activity_participants
                    JOIN users ON activity_participants.userId = users.id
                    WHERE activity_participants.activityId = ?
                    UNION
                    SELECT users.id, users.fullname, users.username
                    FROM activities
                    JOIN users ON activities.creatorId = users.id
                    WHERE activities.id = ?
                `;
                db.all(participantsQuery, [activityId, activityId], (err, participants) => {
                    if (err) participants = [];

                    db.all(`SELECT * FROM expenses WHERE activityId = ?`, [activityId], (allExpenseErr, allExpenses) => {
                        if (allExpenseErr) allExpenses = [];

                        res.render('activity-detail', {
                            activity: activity,
                            activityName: activity.activityName,
                            expenses: expenses,
                            allExpenses: allExpenses,
                            payments: payments,
                            participants: participants,
                            currentUser: req.session.user || null,
                            currentUserId: currentUserId
                        });
                    });
                });
            });
        });
    });
});

// Mahsuplasma Route
app.get('/settlement/:id', (req, res) => {
    const activityId = req.params.id;
    const currentUserId = req.session.userId;

    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) {
            return res.status(404).send("Etkinlik bulunamadı.");
        }

        db.all(`SELECT * FROM expenses WHERE activityId = ? AND userId = ?`, [activityId, currentUserId], (err, expenses) => {
            if (err) expenses = [];

            const paymentsQuery = `
                SELECT payments.*, 
                       sender.fullname AS senderName, sender.username AS senderUsername,
                       receiver.fullname AS receiverName, receiver.username AS receiverUsername
                FROM payments
                JOIN users sender ON payments.senderId = sender.id
                JOIN users receiver ON payments.receiverId = receiver.id
                WHERE payments.activityId = ?
                ORDER BY payments.id DESC
            `;
            db.all(paymentsQuery, [activityId], (err, payments) => {
                if (err) payments = [];

                const participantsQuery = `
                    SELECT users.id, users.fullname, users.username
                    FROM activity_participants
                    JOIN users ON activity_participants.userId = users.id
                    WHERE activity_participants.activityId = ?
                    UNION
                    SELECT users.id, users.fullname, users.username
                    FROM activities
                    JOIN users ON activities.creatorId = users.id
                    WHERE activities.id = ?
                `;
                db.all(participantsQuery, [activityId, activityId], (err, participants) => {
                    if (err) participants = [];

                    db.all(`SELECT * FROM expenses WHERE activityId = ?`, [activityId], (allExpenseErr, allExpenses) => {
                        if (allExpenseErr) allExpenses = [];

                        const viewTemplate = (activity && Number(activity.isClosed) === 2) ? 'settlement-closed' : 'settlement';

                        res.render(viewTemplate, {
                            activity: activity,
                            activityName: activity.activityName,
                            expenses: expenses,
                            allExpenses: allExpenses,
                            payments: payments,
                            participants: participants,
                            currentUser: req.session.user || null,
                            currentUserId: currentUserId
                        });
                    });
                });
            });
        });
    });
});


// Etkinlik Görselini Güncelleme İşlemi
app.post('/activity/:id/upload-image', upload.single('coverImage'), (req, res) => {
    const activityId = req.params.id;
    const currentUserId = req.session.userId;

    if (!currentUserId) {
        return res.status(401).send("Giriş yapmanız gerekiyor.");
    }

    const removeImage = req.body.removeImage === 'true';
    const coverImage = req.file ? '/uploads/' + req.file.filename : null;

    if (coverImage) {
        db.run(`UPDATE activities SET coverImage = ? WHERE id = ?`, [coverImage, activityId], (err) => {
            if (err) {
                console.error("Görsel yüklenirken hata oluştu:", err.message);
                return res.status(500).send("Görsel kaydedilirken bir hata oluştu.");
            }
            res.redirect(`/activity/${activityId}`);
        });
    } else if (removeImage) {
        db.run(`UPDATE activities SET coverImage = NULL WHERE id = ?`, [activityId], (err) => {
            if (err) {
                console.error("Görsel silinirken hata oluştu:", err.message);
                return res.status(500).send("Görsel silinirken bir hata oluştu.");
            }
            res.redirect(`/activity/${activityId}`);
        });
    } else {
        res.redirect(`/activity/${activityId}`);
    }
});

// Ödeme Ekleme İşlemi
// Ödeme Ekleme İşlemi
app.post('/add-payment', (req, res) => {
    const { activityId, receiverUsername, senderUsername, amount, description } = req.body;

    // 1. Önce telefonda/tarayıcıda aktif bir oturum var mı ona bakıyoruz, yoksa formdan gelen ismi kullanıyoruz
    const currentUserId = req.session ? req.session.userId : null;

    const findSender = (callback) => {
        if (currentUserId) {
            return callback(null, currentUserId);
        }
        if (senderUsername) {
            const cleanSender = senderUsername.trim();
            db.get(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [cleanSender], (err, u) => {
                if (err || !u) return callback(new Error('Gönderici kullanıcı bulunamadı.'));
                callback(null, u.id);
            });
        } else {
            callback(new Error('Giriş yapmanız gerekiyor.'));
        }
    };

    findSender((err, senderId) => {
        if (err) {
            return res.status(401).send(err.message + ` <a href="/login">Giriş Yap</a>`);
        }

        const cleanReceiver = receiverUsername ? receiverUsername.trim() : '';

        db.get(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [cleanReceiver], (err, user) => {
            if (err || !user) {
                return res.send(`Hata: '${receiverUsername}' kullanıcı adına sahip bir üye bulunamadı! <a href="/activity/${activityId}">Geri dön</a>`);
            }

            const receiverId = user.id;

            db.get(`SELECT * FROM activity_participants WHERE activityId = ? AND userId = ?`, [activityId, receiverId], (err, part) => {
                if (err || !part) {
                    return res.send(`Hata: Seçtiğiniz kullanıcı bu etkinliğin bir katılımcısı değil! Sadece etkinlikteki kişilere ödeme yapabilirsiniz. <a href="/activity/${activityId}">Geri dön</a>`);
                }

                db.get(`SELECT isClosed FROM activities WHERE id = ?`, [activityId], (err, act) => {
                    if (act && Number(act.isClosed) === 2) {
                        return res.status(403).send("Bu etkinliğin mahsuplaşması kapatılmıştır. Yeni ödeme eklenemez.");
                    }

                    const query = `
                        INSERT INTO payments (activityId, senderId, receiverId, amount, description, status, createdAt)
                        VALUES (?, ?, ?, ?, ?, 'pending', date('now'))
                    `;

                    db.run(query, [activityId, senderId, receiverId, amount, description], (insertErr) => {
                        if (insertErr) {
                            console.error("Ödeme eklenirken hata oluştu:", insertErr.message);
                            return res.status(500).send("Ödeme kaydedilirken bir hata oluştu.");
                        }
                        const referer = req.get('Referrer');
                        if (referer && referer.includes('/settlement/')) {
                            res.redirect(`/settlement/${activityId}`);
                        } else {
                            res.redirect(`/activity/${activityId}`);
                        }
                    });
                });
            });
        });
    });
});

// Ödeme Onaylama İşlemi
app.post('/approve-payment/:id', (req, res) => {
    const paymentId = req.params.id;
    const currentUserId = req.session.userId;

    if (!currentUserId) {
        return res.status(401).send("Giriş yapmanız gerekiyor.");
    }

    db.get(`SELECT * FROM payments WHERE id = ?`, [paymentId], (err, payment) => {
        if (err || !payment) {
            return res.status(404).send("Ödeme bulunamadı.");
        }

        if (String(payment.receiverId) !== String(currentUserId)) {
            return res.status(403).send("Bu ödemeyi sadece alıcı onaylayabilir.");
        }

        db.run(`UPDATE payments SET status = 'approved' WHERE id = ?`, [paymentId], (err) => {
            if (err) {
                return res.status(500).send("Onaylama işleminde hata oluştu.");
            }

            const targetUserId = payment.senderId;
            const approverName = (req.session.user && (req.session.user.fullname || req.session.user.username)) || 'Bir kullanıcı';
            const notificationMessage = `${approverName} kişisi ${payment.amount} TL tutarındaki ödemenizi onayladı.`;

            db.run(
                `INSERT INTO notifications (userId, message, isRead, createdAt) VALUES (?, ?, 0, datetime('now'))`,
                [targetUserId, notificationMessage],
                () => {
                    res.redirect(req.body.returnTo === '/dashboard' ? '/dashboard' : `/activity/${payment.activityId}`);
                }
            );
        });
    });
});

// Ödeme Silme İşlemi
app.post('/delete-payment/:id', (req, res) => {
    const paymentId = req.params.id;
    const currentUserId = req.session.userId;

    if (!currentUserId) {
        return res.status(401).send("Giriş yapmanız gerekiyor.");
    }

    db.get(`SELECT * FROM payments WHERE id = ?`, [paymentId], (err, payment) => {
        if (err || !payment) {
            return res.status(404).send("Ödeme bulunamadı.");
        }

        if (payment.senderId !== currentUserId && payment.receiverId !== currentUserId) {
            return res.status(403).send("Bu işlemi yapmaya yetkiniz yok.");
        }

        db.run(`DELETE FROM payments WHERE id = ?`, [paymentId], (err) => {
            if (err) {
                return res.status(500).send("Silme işleminde hata oluştu.");
            }
            res.redirect(`/activity/${payment.activityId}`);
        });
    });
});

// Harcama Ekleme Sayfası
app.get('/add-expense', (req, res) => {
    const activityId = req.query.activityId;
    res.render('add-expense', { activityId: activityId });
});

app.post('/add-expense', upload.array('receipt'), (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Harcama eklemek için giriş yapmanız gerekiyor.');
    }
    const body = req.body || {};
    const expenseName = body.expenseName;
    const amount = body.amount;
    const activityId = body.activityId;
    const receiptFileName = req.files && req.files.length > 0 ? req.files[0].filename : null;

    db.get(`SELECT isClosed FROM activities WHERE id = ?`, [activityId], (err, act) => {
        if (act && Number(act.isClosed) >= 1) {
            return res.status(403).send("Bu etkinlikte harcama ekleme kapatılmıştır. Mahsuplaşma veya rapor aşamasındadır.");
        }

        db.run(`INSERT INTO expenses (activityId, expenseName, amount, receipt, userId) VALUES (?, ?, ?, ?, ?)`,
            [activityId, expenseName, amount, receiptFileName, req.session.userId], (err) => {
                if (err) console.error("Harcama eklenirken hata oluştu:", err.message);

                if (activityId) {
                    res.redirect(`/activity/${activityId}`);
                } else {
                    res.redirect('/panel');
                }
            });
    });
});

// Harcama Silme
app.post('/delete-expense/:id', (req, res) => {
    const expenseId = req.params.id;

    db.get(`SELECT activityId FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err || !row) return res.redirect('back');

        const activityId = row.activityId;

        db.run(`DELETE FROM expenses WHERE id = ?`, [expenseId], (err) => {
            if (err) return res.status(500).send("Silme sırasında bir hata oluştu.");
            res.redirect(`/activity/${activityId}`);
        });
    });
});

// Harcama Düzenleme İşlemini Kaydetme
app.post('/edit-expense/:id', upload.array('receipt'), (req, res) => {
    const expenseId = req.params.id;
    const { expenseName, amount } = req.body;
    const newReceipt = req.files && req.files.length > 0 ? req.files[0].filename : null;

    // Önce harcamanın hangi etkinliğe ait olduğunu bulalım ki işlem bitince o etkinliğe geri yönlendirebilelim
    db.get(`SELECT activityId, receipt FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err || !row) {
            return res.status(404).send("Harcama bulunamadı.");
        }

        const activityId = row.activityId;
        // Eğer yeni bir dosya yüklenmediyse eskisini koruyoruz
        const receiptToSave = newReceipt ? newReceipt : row.receipt;

        const updateQuery = `UPDATE expenses SET expenseName = ?, amount = ?, receipt = ? WHERE id = ?`;
        db.run(updateQuery, [expenseName, amount, receiptToSave, expenseId], (updateErr) => {
            if (updateErr) {
                console.error("Harcama güncellenirken hata oluştu:", updateErr.message);
                return res.status(500).send("Güncelleme sırasında bir hata oluştu.");
            }

            res.redirect(`/activity/${activityId}`);
        });
    });
});

// Görünüm tercihini veritabanına kaydet
app.post('/update-layout', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Unauthorized');
    }
    const layout = req.body.layout === 'list' ? 'list' : 'grid';
    db.run(`UPDATE users SET panel_layout = ? WHERE id = ?`, [layout, req.session.userId], (err) => {
        if (err) {
            console.error('Layout güncellenemedi:', err);
            return res.status(500).send('Error');
        }
        if (req.session.user) {
            req.session.user.panel_layout = layout;
        }
        res.json({ success: true, layout });
    });
});

// Panel Sayfası
app.get('/panel', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const activeQuery = `
        SELECT DISTINCT activities.*
        FROM activities
        LEFT JOIN activity_participants ON activity_participants.activityId = activities.id
        WHERE (activities.creatorId = ? OR activity_participants.userId = ?)
          AND (activities.isClosed IS NULL OR activities.isClosed = 0 OR activities.isClosed = 1)
        ORDER BY activities.id DESC
    `;

    const closedQuery = `
        SELECT DISTINCT activities.*
        FROM activities
        LEFT JOIN activity_participants ON activity_participants.activityId = activities.id
        WHERE (activities.creatorId = ? OR activity_participants.userId = ?)
          AND activities.isClosed = 2
        ORDER BY activities.id DESC
    `;

    db.all(activeQuery, [req.session.userId, req.session.userId], (errActive, activeActivities) => {
        if (errActive) {
            console.error(errActive.message);
            return res.send("Bir hata oluştu.");
        }
        db.all(closedQuery, [req.session.userId, req.session.userId], (errClosed, closedActivities) => {
            if (errClosed) {
                console.error(errClosed.message);
                return res.send("Bir hata oluştu.");
            }
            res.render('panel', {
                fullname: req.session.user.username,
                user: req.session.user,
                activities: activeActivities,
                closedActivities: closedActivities,
                success: req.query.success,
                panelLayout: req.session.user.panel_layout || 'grid'
            });
        });
    });
});

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. Profil Görüntüleme Sayfası (Profil menüsü)
app.get('/profile', (req, res) => {
    const currentUser = req.user || (req.session && req.session.user);
    if (!currentUser) return res.redirect('/login');

    const userId = currentUser.id || currentUser._id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        const userData = user || currentUser;
        res.render('profile', { user: userData });
    });
});
app.get('/profile/edit', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        res.render('profile-edit', {
            user: user || {},
            showOtpModal: false,
            error: null
        });
    });
});



// 3. Profil Formu Gönderildiğinde (POST)
app.post('/profile/edit', upload.single('avatar'), (req, res) => {
    const currentUser = req.user || (req.session && req.session.user);
    if (!currentUser) return res.redirect('/login');

    const userId = currentUser.id || currentUser._id;
    const { phone } = req.body;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.redirect('/login');

        // username ve email değiştirilemez, her zaman DB'deki değer kullanılır
        let newPhone = phone ? phone.trim() : user.phone;

        let newAvatar = user.avatar;
        if (req.file) {
            newAvatar = '/uploads/' + req.file.filename;
        }

        const isPhoneChanged = newPhone !== user.phone;

        if (isPhoneChanged) {
            const otpCode = generateOTP();
            req.session.pendingUpdate = {
                userId,
                newUsername: user.username,
                newEmail: user.email,
                newPhone,
                newAvatar,
                otpCode
            };

            console.log("---------------------------------------");
            console.log(`[ONAY KODU]: ${otpCode}`);
            console.log("---------------------------------------");

            return res.render('profile-edit', {
                user: { ...user, phone: newPhone },
                showOtpModal: true,
                error: null
            });
        }

        const updateSql = `UPDATE users SET phone = ?, avatar = ? WHERE id = ?`;
        db.run(updateSql, [newPhone, newAvatar, userId], function (updateErr) {
            if (updateErr) return res.redirect('/profile/edit');

            if (req.session && req.session.user) {
                req.session.user.phone = newPhone;
                req.session.user.avatar = newAvatar;
            }
            res.redirect('/panel');
        });
    });
});

// Onay Kodunu Doğrulama (POST)
app.post('/profile/verify-otp', (req, res) => {
    const pending = req.session.pendingUpdate;
    const { otpInput } = req.body;

    if (!pending) {
        return res.redirect('/profile/edit');
    }

    if (otpInput === pending.otpCode) {
        const updateSql = `UPDATE users SET username = ?, email = ?, phone = ?, avatar = ? WHERE id = ?`;
        db.run(updateSql, [pending.newUsername, pending.newEmail, pending.newPhone, pending.newAvatar, pending.userId], function (err) {
            if (req.session && req.session.user) {
                req.session.user.username = pending.newUsername;
                req.session.user.email = pending.newEmail;
                req.session.user.phone = pending.newPhone;
                req.session.user.avatar = pending.newAvatar;
            }
            delete req.session.pendingUpdate;
            res.redirect('/panel');
        });
    } else {
        res.render('profile-edit', {
            user: { ...req.session.user, email: pending.newEmail, phone: pending.newPhone },
            showOtpModal: true,
            error: 'Girdiğiniz onay kodu hatalı!'
        });
    }
});

// Etkinliği Silme
app.post('/activity/delete/:id', (req, res) => {
    if (!req.session || !req.session.userId) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(401).json({ success: false, message: "Oturum açmanız gerekiyor." });
        }
        return res.redirect('/login');
    }

    const activityId = req.params.id;

    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) {
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(404).json({ success: false, message: "Etkinlik bulunamadı." });
            }
            return res.send("Etkinlik bulunamadı.");
        }

        if (String(activity.creatorId) !== String(req.session.userId)) {
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(403).json({ success: false, message: "Sadece etkinlik sahibi bu etkinliği silebilir." });
            }
            return res.status(403).send("Sadece etkinlik sahibi bu etkinliği silebilir.");
        }

        // İlişkili harcamaları, ödemeleri ve katılımcıları temizle
        db.run(`DELETE FROM expenses WHERE activityId = ?`, [activityId], (err1) => {
            if (err1) console.error('Harcama silme hatası:', err1.message);

            db.run(`DELETE FROM payments WHERE activityId = ?`, [activityId], (err2) => {
                if (err2) console.error('Ödeme silme hatası:', err2.message);

                db.run(`DELETE FROM activity_participants WHERE activityId = ?`, [activityId], (err3) => {
                    if (err3) console.error('Katılımcı silme hatası:', err3.message);

                    db.run(`DELETE FROM activities WHERE id = ?`, [activityId], (err4) => {
                        if (err4) {
                            console.error('Etkinlik silme hatası:', err4.message);
                            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                                return res.status(500).json({ success: false, message: "Silinirken bir hata oluştu." });
                            }
                            return res.send("Silinirken bir hata oluştu.");
                        }

                        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                            return res.json({ success: true });
                        }
                        res.redirect('/panel');
                    });
                });
            });
        });
    });
});

// Düzenleme Sayfasını Açma
app.get('/activity/edit/:id', (req, res) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const activityId = req.params.id;
    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, row) => {
        if (err || !row) {
            return res.send("Etkinlik bulunamadı.");
        }
        if (String(row.creatorId) !== String(req.session.userId)) {
            return res.status(403).send("Sadece etkinlik sahibi bu etkinliği düzenleyebilir.");
        }
        res.render('edit-activity', { activity: row });
    });
});

// Harcama Düzenleme Sayfasını Açma
app.get('/edit-expense/:id', (req, res) => {
    const expenseId = req.params.id;
    db.get(`SELECT * FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.send("Bir hata oluştu.");
        }
        res.render('edit-expense', { expense: row });
    });
});

// Etkinliği Güncelleme
app.post('/activity/edit/:id', (req, res) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const activityId = req.params.id;
    const { activityName, activityPassword } = req.body;

    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, row) => {
        if (err || !row) {
            return res.send("Etkinlik bulunamadı.");
        }
        if (String(row.creatorId) !== String(req.session.userId)) {
            return res.status(403).send("Sadece etkinlik sahibi bu etkinliği düzenleyebilir.");
        }

        db.run(
            `UPDATE activities SET activityName = ?, activityPassword = ? WHERE id = ?`,
            [activityName, activityPassword, activityId],
            (err) => {
                if (err) {
                    console.error(err.message);
                    return res.send("Güncellenirken bir hata oluştu.");
                }
                res.redirect('/panel');
            }
        );
    });
});

// Katılımcı Yönetimi
function getParticipantManagementState(activityId, userId, callback) {
    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) return callback(err || new Error('Etkinlik bulunamadi'));

        if (!activity.creatorId && userId) {
            db.run(`UPDATE activities SET creatorId = ? WHERE id = ? AND creatorId IS NULL`, [userId, activityId]);
            activity.creatorId = userId;
        }

        if (activity.creatorId) {
            db.run(`INSERT INTO activity_participants (activityId, userId)
                    SELECT ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1 FROM activity_participants WHERE activityId = ? AND userId = ?
                    )`, [activityId, activity.creatorId, activityId, activity.creatorId]);
        }

        db.get(`SELECT
            (SELECT COUNT(*) FROM expenses WHERE activityId = ?) AS expenseCount,
            (SELECT COUNT(*) FROM payments WHERE activityId = ?) AS paymentCount`,
            [activityId, activityId], (countErr, counts) => {
                if (countErr) return callback(countErr);
                const isClosedState = activity.isClosed !== null && activity.isClosed !== undefined && Number(activity.isClosed) >= 1;
                const isLocked = (counts.expenseCount + counts.paymentCount) > 0 || isClosedState;
                callback(null, activity, activity.creatorId === userId, isLocked);
            });
    });
}

function requireParticipantManagement(req, res, callback) {
    if (!req.session.userId) return res.status(401).send('Bu islem icin giris yapmaniz gerekiyor.');
    getParticipantManagementState(req.params.id, req.session.userId, (err, activity, isOwner, isLocked) => {
        if (err) return res.status(404).send('Etkinlik bulunamadi.');
        if (!isOwner) return res.status(403).send('Katılımcıları yalnızca etkinliği oluşturan kişi yönetebilir.');
        if (activity.isClosed !== null && activity.isClosed !== undefined && Number(activity.isClosed) >= 1) {
            return res.status(409).send('Mahsuplaşma aşamasına geçildiği için yeni katılımcı eklenemez veya çıkarılamaz.');
        }
        if (isLocked) return res.status(409).send('Harcama veya ödeme kaydı olduğu için katılımcılar değiştirilemez.');
        callback(activity);
    });
}

app.post('/activity/:id/participants/add', (req, res) => {
    requireParticipantManagement(req, res, () => {
        db.run(`INSERT OR IGNORE INTO activity_participants (activityId, userId) VALUES (?, ?)`, [req.params.id, req.body.userId], (err) => {
            if (err) return res.status(500).send('Katılımcı eklenemedi.');
            res.redirect(`/share-activity/${req.params.id}`);
        });
    });
});

app.post('/activity/:id/participants/:userId/remove', (req, res) => {
    requireParticipantManagement(req, res, (activity) => {
        if (String(activity.creatorId) === String(req.params.userId)) {
            return res.status(400).send('Etkinlik sahibi katılımcı listesinden çıkarılamaz.');
        }
        db.run(`DELETE FROM activity_participants WHERE activityId = ? AND userId = ?`, [req.params.id, req.params.userId], (err) => {
            if (err) return res.status(500).send('Katılımcı çıkarılamadı.');
            res.redirect(`/share-activity/${req.params.id}`);
        });
    });
});

// Share Activity
app.get('/share-activity/:id', (req, res) => {
    const activityId = req.params.id;
    // Determine base URL for QR code. If the request host is localhost, replace it with the detected local network IP if available.
    let host = req.get('host');
    if (host && host.includes('localhost') && localNetworkIp) {
        host = `${localNetworkIp}:${PORT}`;
    }
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${host}`;
    const inviteLink = `${baseUrl}/join/${activityId}`;

    QRCode.toDataURL(inviteLink, (err, qrCodeUrl) => {
        if (err) return res.send("QR kod oluşturulamadı.");

        db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
            if (err || !activity) return res.send("Etkinlik bulunamadı.");

            getParticipantManagementState(activityId, req.session.userId, (stateErr, stateActivity, isOwner, isLocked) => {
                if (stateErr) return res.status(500).send('Katılımcı bilgileri alınamadı.');
                db.all(`SELECT users.id, users.fullname, users.username
                        FROM activity_participants
                        JOIN users ON users.id = activity_participants.userId
                        WHERE activity_participants.activityId = ?
                        ORDER BY users.fullname COLLATE NOCASE, users.username COLLATE NOCASE`, [activityId], (participantErr, participants) => {
                    if (participantErr) return res.status(500).send('Katılımcılar alınamadı.');
                    db.all(`SELECT id, fullname, username FROM users
                            WHERE id NOT IN (SELECT userId FROM activity_participants WHERE activityId = ?)
                            ORDER BY fullname COLLATE NOCASE, username COLLATE NOCASE`, [activityId], (userErr, availableUsers) => {
                        if (userErr) return res.status(500).send('Kullanıcılar alınamadı.');
                        res.render('share-activity', {
                            activity: stateActivity,
                            qrCodeUrl: qrCodeUrl,
                            inviteLink: inviteLink,
                            participants: participants,
                            availableUsers: availableUsers,
                            isOwner: isOwner,
                            isLocked: isLocked,
                            currentUserId: req.session ? req.session.userId : null
                        });
                    });
                });
            });
        });
    });
});

// Join Activity
app.get('/join/:id', (req, res) => {
    if (!req.session.userId) {
        req.session.returnTo = `/join/${req.params.id}`;
        return res.redirect('/login');
    }

    const activityId = req.params.id;
    const userId = req.session.userId;

    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) return res.send("Etkinlik bulunamadı.");

        if (activity.isClosed !== null && activity.isClosed !== undefined && Number(activity.isClosed) >= 1) {
            return res.send(`Etkinliğin mahsuplaşma aşamasına geçildiği için yeni katılımcı eklenemez! <a href="/settlement/${activityId}">Mahsuplaşma Sayfasına Git</a>`);
        }

        db.get(`SELECT * FROM activity_participants WHERE activityId = ? AND userId = ?`, [activityId, userId], (err, row) => {
            if (row) {
                if (Number(activity.isClosed) >= 1) {
                    return res.redirect(`/settlement/${activityId}`);
                } else {
                    return res.redirect(`/activity/${activityId}`);
                }
            }

            db.run(`INSERT INTO activity_participants (activityId, userId) VALUES (?, ?)`, [activityId, userId], (err) => {
                if (err) return res.send("Etkinliğe katılırken bir hata oluştu.");
                res.redirect(`/activity/${activityId}`);
            });
        });
    });
});

// Notifications API
app.get('/api/notifications', (req, res) => {
    if (!req.session || !req.session.userId) return res.json({ success: false, notifications: [] });
    db.all(`SELECT * FROM notifications WHERE userId = ? ORDER BY id DESC LIMIT 15`, [req.session.userId], (err, rows) => {
        if (err) return res.json({ success: false, notifications: [] });
        res.json({ success: true, notifications: rows });
    });
});

const handleClearNotifications = (req, res) => {
    if (!req.session || !req.session.userId) return res.json({ success: false });
    db.run(`UPDATE notifications SET isRead = 1 WHERE userId = ?`, [req.session.userId], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
};

app.post('/api/notifications/clear', handleClearNotifications);
app.post('/notifications/clear', handleClearNotifications);

const handleDeleteNotification = (req, res) => {
    if (!req.session || !req.session.userId) return res.json({ success: false });
    const id = req.params.id;
    db.run(`DELETE FROM notifications WHERE id = ? AND userId = ?`, [id, req.session.userId], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
};

app.post('/api/notifications/delete/:id', handleDeleteNotification);
app.post('/notifications/delete/:id', handleDeleteNotification);

// Edit Payment
app.get('/edit-payment/:id', (req, res) => {
    const paymentId = req.params.id;
    if (!req.session.userId) return res.redirect('/login');

    db.get(`
        SELECT payments.*, receiver.username AS receiverUsername
        FROM payments
        JOIN users receiver ON payments.receiverId = receiver.id
        WHERE payments.id = ?
    `, [paymentId], (err, row) => {
        if (err || !row) return res.redirect('back');
        if (row.status === 'approved') {
            return res.send(`Bu ödeme onaylandığı için düzenlenemez. <a href="/activity/${row.activityId}">Geri dön</a>`);
        }
        res.render('edit-payment', { payment: row });
    });
});

app.post('/edit-payment/:id', (req, res) => {
    const paymentId = req.params.id;
    const { receiverUsername, amount, description } = req.body;
    if (!req.session.userId) return res.redirect('/login');

    const cleanReceiverUsername = receiverUsername ? receiverUsername.trim() : '';
    db.get(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [cleanReceiverUsername], (err, user) => {
        if (err || !user) {
            return res.send(`Hata: '${receiverUsername}' kullanıcı adına sahip bir üye bulunamadı! <a href="/edit-payment/${paymentId}">Geri dön</a>`);
        }

        const receiverId = user.id;

        db.get(`SELECT activityId, status FROM payments WHERE id = ?`, [paymentId], (err, row) => {
            if (err || !row) return res.send("Güncelleme hatası.");

            if (row.status === 'approved') {
                return res.send(`Bu ödeme onaylandığı için düzenlenemez. Sadece silinebilir. <a href="/activity/${row.activityId}">Geri dön</a>`);
            }

            const activityId = row.activityId;

            db.run(
                `UPDATE payments SET receiverId = ?, amount = ?, description = ? WHERE id = ?`,
                [receiverId, amount, description, paymentId],
                (err) => {
                    if (err) return res.send("Güncelleme hatası.");
                    res.redirect(`/activity/${activityId}`);
                }
            );
        });
    });
});

// Security
// Geri Bildirim Gönderme Rotası
app.post('/send-feedback', (req, res) => {
    const { feedbackType, message, contactInfo } = req.body;
    const user = req.session && req.session.user;
    const userId = (req.session && req.session.userId) || (user && user.id) || null;
    const senderInfo = user ? `${user.fullname || user.username} (${user.email || 'E-posta yok'})` : (contactInfo || 'Anonim Kullanıcı');
    const createdAt = new Date().toISOString();

    db.run(
        `INSERT INTO feedbacks (userId, feedbackType, message, contactInfo, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [userId, feedbackType, message, contactInfo || (user ? user.email : ''), createdAt],
        function (dbErr) {
            if (dbErr) {
                console.error("Geri bildirim DB kaydetme hatası:", dbErr.message);
            }

            // Arka planda e-posta gönder
            const mailOptions = {
                from: 'saadetsudegunes31@gmail.com',
                to: 'saadetsudegunes31@gmail.com',
                subject: `[Hesapmatik Geri Bildirim] ${feedbackType || 'Genel Şikayet / Öneri'}`,
                text: `Gönderen: ${senderInfo}\nİletişim Bilgisi: ${contactInfo || 'Belirtilmedi'}\nKonu: ${feedbackType || 'Geri Bildirim'}\n\nMesaj:\n${message}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.warn('Geri bildirim e-posta gönderilemedi (DB kaydı alındı):', error.message);
                } else {
                    console.log('Geri bildirim e-postası başarıyla gönderildi:', info && info.response);
                }
            });

            // Kullanıcıya anında başarılı yanıt dön
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.headers['content-type'] === 'application/x-www-form-urlencoded') {
                return res.json({ success: true, message: "Geri bildiriminiz başarıyla iletildi! Teşekkür ederiz." });
            }
            res.redirect(req.get('Referrer') || '/panel');
        }
    );
});

app.get('/profile/security', (req, res) => {
    const currentUser = req.user || (req.session && req.session.user);
    if (!currentUser) return res.redirect('/login');

    const userId = currentUser.id || currentUser._id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.render('security', { user: currentUser, success: null, error: null });
        }
        res.render('security', { user, success: null, error: null });
    });
});

app.post('/profile/security', async (req, res) => {
    const currentUser = req.user || (req.session && req.session.user);
    if (!currentUser) return res.redirect('/login');

    const { currentPassword, newPassword } = req.body;
    const userId = currentUser.id || currentUser._id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) {
            return res.render('security', { user: currentUser, error: 'Kullanıcı bulunamadı.', success: null });
        }

        if (!currentPassword || !newPassword) {
            return res.render('security', { user, error: 'Lütfen mevcut şifrenizi ve yeni şifrenizi girin!', success: null });
        }

        let isMatch = (currentPassword === user.password);

        if (!isMatch) {
            return res.render('security', { user, error: 'Mevcut şifreniz hatalı!', success: null });
        }

        db.run('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId], function (updateErr) {
            if (updateErr) {
                return res.render('security', { user, error: 'Şifre güncellenirken bir hata oluştu.', success: null });
            }

            user.password = newPassword;
            if (req.session) req.session.user = user;

            res.render('security', { user, success: 'Şifreniz başarıyla güncellenmiştir.', error: null });
        });
    });
});

// Borç Hatırlatma Bildirimi Gönder
app.post('/notify-debt', (req, res) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const { targetUserId, activityName, activityId } = req.body;
    const senderName = req.session.user ? (req.session.user.fullname || req.session.user.username) : "Bir kullanıcı";
    const message = `🔔 ${senderName} kullanıcısı size "${activityName}" etkinliğindeki borcunuzu hatırlattı!`;
    const createdAt = new Date().toISOString();
    db.run(`INSERT INTO notifications (userId, message, createdAt) VALUES (?, ?, ?)`, [targetUserId, message, createdAt], function (err) {
        if (err) { console.error("Bildirim gönderilirken hata:", err.message); return res.send("Hata oluştu."); }
        res.redirect('/activity/' + activityId);
    });
});

// Kişiyi Etkinlikten Çıkar
app.post('/remove-participant', (req, res) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const { targetUserId, activityId } = req.body;
    db.all(`SELECT * FROM expenses WHERE activityId = ?`, [activityId], (err, expenses) => {
        if (err) { console.error(err); return res.send("Hata oluştu."); }
        if (expenses && expenses.length > 0) {
            return res.redirect('/activity/' + activityId + '?error=Harcama yapıldığı için kişi çıkarılamaz');
        }
        db.run(`DELETE FROM activity_participants WHERE activityId = ? AND userId = ?`, [activityId, targetUserId], function (err) {
            if (err) { console.error("Kişi silinirken hata:", err.message); return res.send("Hata oluştu."); }
            res.redirect('/activity/' + activityId);
        });
    });
});

// 1. AŞAMA KAPANIŞI: Harcama Eklemesini Kapatıp Mahsuplaşma / Ödeme Aşamasına Geç (isClosed = 1)
app.post('/close-activity/:id', (req, res) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const activityId = req.params.id;

    db.get('SELECT * FROM activities WHERE id = ?', [activityId], (err, activity) => {
        if (err || !activity) return res.send('Etkinlik bulunamadı.');

        if (String(activity.creatorId) !== String(req.session.userId)) {
            return res.status(403).send('Sadece etkinlik sahibi harcama eklemeyi kapatabilir.');
        }

        db.run('UPDATE activities SET isClosed = 1 WHERE id = ?', [activityId], function (err) {
            if (err) {
                console.error(err);
                return res.send('Hata oluştu');
            }
            res.redirect(`/settlement/${activityId}`);
        });
    });
});

// 2. AŞAMA KAPANIŞI: Mahsuplaşmayı Kapat ve Rapor Moduna Geç (isClosed = 2)
app.post('/finish-settlement/:id', (req, res) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const activityId = req.params.id;

    db.get('SELECT * FROM activities WHERE id = ?', [activityId], (err, activity) => {
        if (err || !activity) return res.send('Etkinlik bulunamadı.');

        if (String(activity.creatorId) !== String(req.session.userId)) {
            return res.status(403).send('Sadece etkinlik sahibi mahsuplaşmayı kapatabilir.');
        }

        db.run('UPDATE activities SET isClosed = 2 WHERE id = ?', [activityId], function (err) {
            if (err) {
                console.error(err);
                return res.send('Hata oluştu');
            }
            res.redirect(`/settlement/${activityId}`);
        });
    });
});

// Hesap pasife alma rotası
app.post('/profile/delete', async (req, res) => {
    console.log('=== /profile/delete ROUTE HIT ===');
    console.log('Session:', JSON.stringify(req.session));
    try {
        const userId = req.session.userId || (req.session.user ? req.session.user.id : null);
        console.log('Pasif edilecek userId:', userId);

        if (!userId) {
            console.log('userId bulunamadı, oturum düşmüş.');
            return res.status(401).send(`
                <script>
                alert('Oturumunuz sona ermiş. Lütfen tekrar giriş yapıp Hesabı Pasif Et butonuna basın.');
                window.location.href = '/login';
                </script>
            `);
        }

        const parsedUserId = parseInt(userId, 10);
        console.log('Parse edilen userId:', parsedUserId);

        db.run("UPDATE users SET status = 'passive' WHERE id = ?", [parsedUserId], function (err) {
            if (err) {
                console.error('Hesap pasife alınırken veritabanı hatası:', err);
                return res.status(500).send('Hesap pasife alınırken bir hata oluştu.');
            }
            console.log('Pasife alma - Etkilenen satır sayısı:', this.changes);
            const affected = this.changes;

            req.session.destroy(() => {
                if (affected === 0) {
                    return res.status(200).send(`
                        <script>
                        alert('HATA: Veritabanında kullanıcı bulunamadı! ID: ${parsedUserId}');
                        window.location.href = '/login';
                        </script>
                    `);
                }
                return res.status(200).send(`
                    <script>
                    alert('Hesabınız başarıyla pasife alınmıştır.');
                    window.location.href = '/login';
                    </script>
                `);
            });
        });
    } catch (err) {
        console.error('Try catch hatası:', err);
        res.status(500).send('Hesap pasife alınırken bir hata oluştu.');
    }
});

// Sunucuyu Başlat (Listen Bloğu)
app.listen(process.env.PORT || PORT, '0.0.0.0', () => {
    console.log(`Sunucu ayakta: http://localhost:${process.env.PORT || PORT}`);
    if (localNetworkIp) {
        console.log(`Aynı Wi-Fi ağı için: http://${localNetworkIp}:${process.env.PORT || PORT}`);
    }
});
