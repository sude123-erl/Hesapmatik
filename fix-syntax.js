const fs = require('fs');

try {
    let code = fs.readFileSync('server.js', 'utf8');

    const correctBlock = `// Notifications API
app.get('/api/notifications', (req, res) => {
    if (!req.session.userId) return res.json({ success: false, notifications: [] });
    db.all('SELECT * FROM notifications WHERE userId = ? ORDER BY id DESC LIMIT 15', [req.session.userId], (err, rows) => {
        if (err) return res.json({ success: false, notifications: [] });
        res.json({ success: true, notifications: rows });
    });
});

app.post('/api/notifications/delete/:id', (req, res) => {
    if (!req.session.userId) return res.json({ success: false });
    db.run('DELETE FROM notifications WHERE id = ? AND userId = ?', [req.params.id, req.session.userId], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/notifications/clear', (req, res) => {
    if (!req.session.userId) return res.json({ success: false });
    db.run('DELETE FROM notifications WHERE userId = ?', [req.session.userId], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// Edit Payment`;

    const startIndex = code.indexOf('// Notifications API');
    const endIndex = code.indexOf('// Edit Payment');

    if (startIndex !== -1 && endIndex !== -1) {
        code = code.substring(0, startIndex) + correctBlock + code.substring(endIndex + 15);
        fs.writeFileSync('server.js', code);
        console.log('Fixed syntax and routes in server.js');
    } else {
        console.log('Could not find boundaries');
    }
} catch (e) {
    console.error(e);
}
