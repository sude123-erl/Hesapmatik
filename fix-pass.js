const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `
        let isMatch = false;
        if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'))) {
            const bcrypt = require('bcrypt');
            isMatch = await bcrypt.compare(currentPassword, user.password);
        } else {
            isMatch = (currentPassword === user.password);
        }

        if (!isMatch) {
            return res.render('security', { user, error: 'Mevcut şifreniz hatalı!', success: null });
        }

        if (newPassword === currentPassword) {
            return res.render('security', { user, error: 'Yeni şifreniz eskisiyle aynı olamaz!', success: null });
        }
`;

code = code.replace(/let isMatch = \(currentPassword === user\.password\);\s*if \(!isMatch\) \{\s*return res\.render\('security', \{ user, error: 'Mevcut şifreniz hatalı!', success: null \}\);\s*\}/, replacement);

fs.writeFileSync('server.js', code);
console.log('Update password logic fixed.');
