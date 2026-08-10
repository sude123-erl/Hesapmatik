const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const replacement1 = `        if (!userId) {
            console.log('userId bulunamadı, oturum düşmüş.');
            return res.redirect('/login?toast_error=' + encodeURIComponent('Oturumunuz sona ermiş. Lütfen tekrar giriş yapıp Hesabı Pasif Et butonuna basın.'));
        }`;

code = code.replace(
    /if \(!userId\) \{[\s\S]*?<\/script>\s*`\);\s*\}/,
    replacement1
);

const replacement2 = `            req.session.destroy(() => {
                if (affected === 0) {
                    return res.redirect('/login?toast_error=' + encodeURIComponent('HATA: Veritabanında kullanıcı bulunamadı!'));
                }
                return res.redirect('/login?toast_success=' + encodeURIComponent('Hesabınız başarıyla pasife alınmıştır.'));
            });
        });`;

code = code.replace(
    /req\.session\.destroy\(\(\) => \{[\s\S]*?\}\);\s*\}\);/,
    replacement2
);

fs.writeFileSync('server.js', code);
console.log('Server.js /profile/delete updated successfully');
