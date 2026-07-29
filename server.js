const nodemailer = require('nodemailer');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');

const app = express();
app.use('/uploads', express.static('uploads'));
const PORT = 2024;
const upload = multer({ dest: 'uploads/' });

const session = require('express-session');

app.use(session({
    secret: 'gizli-anahtar-kelime',
    resave: false,
    saveUninitialized: false
}));

// E-posta gönderici ayarları (Gmail SMTP)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'saadetsudegunes31.@gmail.com',
        pass: 'ycprxvmvcoagxveb'
    }
});

// Form verilerini okuyabilmek için middleware ayarları
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Veritabanı bağlantısı ve tablolar
const db = new sqlite3.Database('./hesapmatik.db', (err) => {
    if (err) {
        console.error('Veritabanı hatası:', err.message);
    } else {
        console.log('SQLite veritabanına bağlandık!');

        db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activityId INTEGER,
    expenseName TEXT,
    amount REAL,
    receipt TEXT
)`);
        db.run(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activityName TEXT,
    activityPassword TEXT,
    coverImage TEXT,
    activityDate TEXT,
    creatorId INTEGER
)`);
    }
});

db.run(`ALTER TABLE activities ADD COLUMN creatorId INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
        console.error('Etkinlik sahipligi alani eklenemedi:', err.message);
    }
});

db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    username TEXT UNIQUE,
    phone TEXT,
    email TEXT UNIQUE,
    password TEXT,
    reset_code TEXT
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

// Ana Sayfa
app.get('/', (req, res) => {
    res.send('Hesapmatik çalışıyor!');
});

// Kayıt Ol Sayfası ve İşlemi
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { fullname, username, phone, email, password } = req.body;
    const query = `INSERT INTO users (fullname, username, phone, email, password) VALUES (?, ?, ?, ?, ?)`;

    db.run(query, [fullname, username, phone, email, password], (err) => {
        if (err) {
            console.error('Kayıt hatası:', err.message);
            return res.send('Bu kullanıcı adı veya e-posta zaten kayıtlı!');
        }
        res.send('Kayıt başarılı! Giriş yapabilirsiniz.');
    });
});

// Giriş Sayfası ve İşlemi
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = `SELECT * FROM users WHERE username = ? AND password = ?`;

    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error('Giriş hatası:', err.message);
            return res.send('Bir hata oluştu!');
        }

        if (row) {
            req.session.userId = row.id;
            req.session.user = row;

            // Giriş başarılı olur olmaz doğrudan karşılama ekranına yönlendiriyoruz
            return res.redirect('/dashboard');
        } else {
            res.send('Kullanıcı adı veya şifre hatalı! <a href="/login">Geri dön</a>');
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login');
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
            res.send('Şifren başarıyla değiştirildi! <a href="/login">Giriş Yap</a>');
        });
    });
});

// Yeni Etkinlik Oluşturma Sayfası
app.get('/create-activity', (req, res) => {
    res.render('create');
});

// Etkinliği Veritabanına Kaydetme ve Detay Sayfasına Yönlendirme
app.post('/create-activity', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    const { activityName, activityPassword, activityDate } = req.body;
    const query = `INSERT INTO activities (activityName, activityPassword, activityDate, creatorId) VALUES (?, ?, ?, ?)`;

    db.run(query, [activityName, activityPassword, activityDate, req.session.userId], function (err) {
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

    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) {
            return res.status(404).send("Etkinlik bulunamadı.");
        }

        db.all(`SELECT * FROM expenses WHERE activityId = ?`, [activityId], (err, expenses) => {
            if (err) {
                console.error(err.message);
                expenses = [];
            }

            // Etkinliğe ait ödemeleri çekelim (gönderen ve alan isimleriyle birlikte)
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
                if (err) {
                    console.error(err.message);
                    payments = [];
                }

                // Etkinlik katılımcılarını çekelim
                const participantsQuery = `
                    SELECT users.id, users.fullname, users.username
                    FROM activity_participants
                    JOIN users ON activity_participants.userId = users.id
                    WHERE activity_participants.activityId = ?
                `;
                db.all(participantsQuery, [activityId], (err, participants) => {
                    if (err) {
                        console.error(err.message);
                        participants = [];
                    }

                    res.render('activity-detail', {
                        activity: activity,
                        activityName: activity.activityName,
                        expenses: expenses,
                        payments: payments,
                        participants: participants,
                        currentUser: req.session.user || null,
                        currentUserId: req.session.userId || null
                    });
                });
            });
        });
    });
});



// Ödeme Ekleme İşlemi
app.post('/add-payment', (req, res) => {
    const { activityId, receiverUsername, senderUsername, amount, description } = req.body;

    // Session'dan veya formdan gönderici belirle
    const lookupSender = (callback) => {
        if (req.session && req.session.userId) {
            return callback(null, req.session.userId);
        }
        if (senderUsername) {
            db.get(`SELECT id FROM users WHERE username = ?`, [senderUsername], (err, u) => {
                if (err || !u) return callback(new Error('Gönderici bulunamadı'));
                callback(null, u.id);
            });
        } else {
            callback(new Error('Giriş yapmanız gerekiyor.'));
        }
    };

    lookupSender((err, senderId) => {
        if (err) {
            return res.status(401).send(err.message + ` <a href="/login">Giriş Yap</a>`);
        }

        // Alıcıyı kullanıcı adından bul
        db.get(`SELECT id FROM users WHERE username = ?`, [receiverUsername], (err, user) => {
            if (err || !user) {
                return res.send(`Hata: '${receiverUsername}' kullanıcı adına sahip bir üye bulunamadı! <a href="/activity/${activityId}">Geri dön</a>`);
            }

            const receiverId = user.id;
            const query = `
                INSERT INTO payments (activityId, senderId, receiverId, amount, description, status, createdAt)
                VALUES (?, ?, ?, ?, ?, 'pending', date('now'))
            `;

            db.run(query, [activityId, senderId, receiverId, amount, description], (err) => {
                if (err) {
                    console.error("Ödeme eklenirken hata oluştu:", err.message);
                    return res.status(500).send("Ödeme kaydedilirken bir hata oluştu.");
                }
                res.redirect(`/activity/${activityId}`);
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

        if (payment.receiverId !== currentUserId) {
            return res.status(403).send("Bu ödemeyi sadece alıcı onaylayabilir.");
        }

        db.run(`UPDATE payments SET status = 'approved' WHERE id = ?`, [paymentId], (err) => {
            if (err) {
                console.error("Ödeme onaylanırken hata oluştu:", err.message);
                return res.status(500).send("Onaylama işleminde hata oluştu.");
            }
            res.redirect(`/activity/${payment.activityId}`);
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
                console.error("Ödeme silinirken hata oluştu:", err.message);
                return res.status(500).send("Silme işleminde hata oluştu.");
            }
            res.redirect(`/activity/${payment.activityId}`);
        });
    });
});

// Harcama Ekleme Sayfasını Aç
app.get('/add-expense', (req, res) => {
    const activityId = req.query.activityId;
    res.render('add-expense', { activityId: activityId });
});

// Harcama Verisini Kaydet ve Etkinlik Detayına Yönlendir
app.post('/add-expense', upload.array('receipt'), (req, res) => {
    const body = req.body || {};
    const expenseName = body.expenseName;
    const amount = body.amount;
    const activityId = body.activityId;

    // Yüklenen dosyalardan ilkini alıyoruz (Eğer dosya seçildiyse adı buradan gelir)
    const receiptFileName = req.files && req.files.length > 0 ? req.files[0].filename : null;

    console.log("Gelen Veriler:", { expenseName, amount, activityId, receiptFileName });

    // Veritabanına 'receipt' sütununu da ekleyerek kaydediyoruz
    db.run(`INSERT INTO expenses (activityId, expenseName, amount, receipt) VALUES (?, ?, ?, ?)`,
        [activityId, expenseName, amount, receiptFileName], (err) => {
            if (err) {
                console.error("Harcama eklenirken hata oluştu:", err.message);
            }

            if (activityId) {
                res.redirect(`/activity/${activityId}`);
            } else {
                res.redirect('/panel');
            }
        });
});

// Harcama Silme Rotası
app.post('/delete-expense/:id', (req, res) => {
    const expenseId = req.params.id;

    // Önce silinecek harcamanın hangi aktiviteye ait olduğunu bulalım ki doğru sayfaya geri dönelim
    db.get(`SELECT activityId FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err || !row) {
            console.error(err);
            return res.redirect('back');
        }

        const activityId = row.activityId;

        // Harcamayı veritabanından siliyoruz
        db.run(`DELETE FROM expenses WHERE id = ?`, [expenseId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Silme sırasında bir hata oluştu.");
            }
            // Başarıyla silindikten sonra ilgili aktivite detay sayfasına geri yönlendiriyoruz
            res.redirect(`/activity/${activityId}`);
        });
    });
});

// Geçici profil verisi deposu (Yukarıda olmalı)
let currentUser = {
    username: "Sude",
    avatar: null
};

// Panel Sayfası
app.get('/panel', (req, res) => {
    db.all("SELECT * FROM activities", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send("Bir hata oluştu.");
        }
        res.render('panel', {
            fullname: currentUser.username,
            user: currentUser,
            activities: rows, // Etkinlikleri buraya ekliyoruz
            success: req.query.success // <--- BU SATIRI EKLE
        });
    });
});

// Profil (Ayarlar ve Hareketler) Sayfası
app.get('/profile', (req, res) => {
    res.render('profile', { user: currentUser });
});

// Profil Düzenleme Sayfası (Açılış)
app.get('/profile/edit', (req, res) => {
    res.render('profile-edit', { user: currentUser });
});

// Profil Düzenleme - Form Kaydetme
app.post('/profile/edit', upload.single('avatar'), (req, res) => {
    if (req.body.username) {
        currentUser.username = req.body.username;
    }
    if (req.file) {
        currentUser.avatar = '/uploads/' + req.file.filename;
    }

    res.redirect('/profile');
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`Sunucu ayakta: http://localhost:${PORT}`);
});

// Etkinliği Silme
app.post('/activity/delete/:id', (req, res) => {
    const activityId = req.params.id;
    db.run(`DELETE FROM activities WHERE id = ?`, [activityId], (err) => {
        if (err) {
            console.error(err.message);
            return res.send("Silinirken bir hata oluştu.");
        }
        res.redirect('/panel');
    });
});

// Düzenleme Sayfasını Açma
app.get('/activity/edit/:id', (req, res) => {
    const activityId = req.params.id;
    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.send("Bir hata oluştu.");
        }
        // Etkinlik bilgilerini düzenleme sayfasına gönderiyoruz
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
    const activityId = req.params.id;
    const { activityName, activityPassword } = req.body;

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

// Düzenleme sayfasını açma
app.get('/edit-expense/:id', (req, res) => {
    const expenseId = req.params.id;
    db.get(`SELECT * FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err || !row) {
            console.error(err);
            return res.redirect('back');
        }
        res.render('edit-expense', { expense: row });
    });
});

// Düzenlenen veriyi kaydetme
app.post('/edit-expense/:id', (req, res) => {
    const expenseId = req.params.id;
    const { expenseName, amount } = req.body;

    db.get(`SELECT activityId FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err || !row) {
            return res.status(500).send("Güncelleme hatası.");
        }

        const activityId = row.activityId;

        db.run(`UPDATE expenses SET expenseName = ?, amount = ? WHERE id = ?`, [expenseName, amount, expenseId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Güncelleme hatası.");
            }
            res.redirect(`/activity/${activityId}`);
        });
    });
});


// Harcama Güncelleme İşlemi
app.post('/edit-expense/:id', (req, res) => {
    const expenseId = req.params.id;
    const { expenseName, amount } = req.body;

    // Önce hangi aktiviteye ait olduğunu bulalım ki güncelledikten sonra oraya geri dönebilelim
    db.get(`SELECT activityId FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
        if (err || !row) {
            return res.send("Güncelleme hatası.");
        }

        const activityId = row.activityId;

        // Veritabanındaki harcamayı güncelliyoruz
        db.run(`UPDATE expenses SET expenseName = ?, amount = ? WHERE id = ?`, [expenseName, amount, expenseId], (err) => {
            if (err) {
                console.error(err);
                return res.send("Güncelleme hatası.");
            }
            // Güncelleme başarılı olunca aktivite detay sayfasına geri dön
            res.redirect(`/activity/${activityId}`);
        });
    });
});

function getParticipantManagementState(activityId, userId, callback) {
    db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
        if (err || !activity) return callback(err || new Error('Etkinlik bulunamadi'));

        // Eski etkinliklerde sahiplik bilgisi olmadigi icin, ilk oturum acmis yoneticiye atiyoruz.
        if (!activity.creatorId && userId) {
            db.run(`UPDATE activities SET creatorId = ? WHERE id = ? AND creatorId IS NULL`, [userId, activityId]);
            activity.creatorId = userId;
        }

        db.get(`SELECT
            (SELECT COUNT(*) FROM expenses WHERE activityId = ?) AS expenseCount,
            (SELECT COUNT(*) FROM payments WHERE activityId = ?) AS paymentCount`,
            [activityId, activityId], (countErr, counts) => {
                if (countErr) return callback(countErr);
                callback(null, activity, activity.creatorId === userId, (counts.expenseCount + counts.paymentCount) > 0);
            });
    });
}

function requireParticipantManagement(req, res, callback) {
    if (!req.session.userId) return res.status(401).send('Bu islem icin giris yapmaniz gerekiyor.');
    getParticipantManagementState(req.params.id, req.session.userId, (err, activity, isOwner, isLocked) => {
        if (err) return res.status(404).send('Etkinlik bulunamadi.');
        if (!isOwner) return res.status(403).send('Katılımcıları yalnızca etkinliği oluşturan kişi yönetebilir.');
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

const QRCode = require('qrcode');

// Etkinlik Paylaşım ve QR Sayfası
app.get('/share-activity/:id', (req, res) => {
    const activityId = req.params.id;
    // Kullanıcının tarayıcısında açılacak olan davet linki
    const inviteLink = `${req.protocol}://${req.get('host')}/join/${activityId}`;

    // Bu linki QR koda dönüştürüyoruz
    QRCode.toDataURL(inviteLink, (err, qrCodeUrl) => {
        if (err) {
            console.error(err);
            return res.send("QR kod oluşturulamadı.");
        }

        // Etkinlik bilgilerini de alıp sayfaya gönderelim ki başlığı yazdırabilelim
        db.get(`SELECT * FROM activities WHERE id = ?`, [activityId], (err, activity) => {
            if (err || !activity) {
                return res.send("Etkinlik bulunamadı.");
            }

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
                            isLocked: isLocked
                        });
                    });
                });
            });
        });
    });
});

// Etkinliğe Katılma Rotası
app.get('/join/:id', (req, res) => {
    // Kullanıcı giriş yapmış mı kontrol edelim (session yapına göre burayı req.session.userId veya req.user gibi düzenleyebilirsin)
    if (!req.session.userId) {
        // Giriş yapmamışsa önce login sayfasına yönlendirip, sonrasında buraya geri döndürebiliriz
        return res.redirect('/login');
    }

    const activityId = req.params.id;
    const userId = req.session.userId;

    // Daha önce katılmış mı kontrol edelim, katıldıysa direkt etkinliğe gönderelim
    db.get(`SELECT * FROM activity_participants WHERE activityId = ? AND userId = ?`, [activityId, userId], (err, row) => {
        if (row) {
            return res.redirect(`/activity/${activityId}`);
        }

        // Katılmamışsa tabloya ekleyelim
        db.run(`INSERT INTO activity_participants (activityId, userId) VALUES (?, ?)`, [activityId, userId], (err) => {
            if (err) {
                console.error(err);
                return res.send("Etkinliğe katılırken bir hata oluştu.");
            }
            res.redirect(`/activity/${activityId}`);
        });
    });
});
// Mükerrer rota kaldırıldı

app.get('/activities', (req, res) => {
    res.redirect('/panel');
});

// Harcama Ekleme İşlemi
app.post('/add-expense', upload.array('receipt'), (req, res) => {
    const { activityId, expenseName, amount } = req.body;

    const query = `INSERT INTO expenses (activityId, expenseName, amount) VALUES (?, ?, ?)`;
    db.run(query, [activityId, expenseName, amount], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Harcama eklenirken bir hata oluştu.");
        }
        // Başarıyla eklendikten sonra ilgili etkinlik detay sayfasına geri dön
        res.redirect(`/activity/${activityId}`);
    });
});




app.get('/activities', (req, res) => {
    // Eğer kullanıcı giriş yapmadıysa login sayfasına yönlendir
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    // Kullanıcının etkinliklerini veritabanından çekip ilk görseldeki sayfaya gönderelim
    db.all(`SELECT * FROM activities`, [], (err, activities) => {
        if (err) {
            console.error(err);
            activities = [];
        }
        res.render('panel', { activities: activities, user: req.session.user }); // İlk görselin olduğu dosya adını (örn: panel veya index) buraya yazabilirsin
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }

    db.all("SELECT * FROM activities", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            rows = [];
        }

        res.render('dashboard', {
            user: req.session.user || { username: "Sude" },
            activities: rows
        });
    });
});
