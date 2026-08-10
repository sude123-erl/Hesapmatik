const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// A helper for redirection
const helper = `
function showToastError(req, res, msg) {
    const ref = req.get('Referrer') || '/';
    const cleanRef = ref.split('toast_error=')[0].replace(/[?&]$/, '');
    const cleanSep = cleanRef.includes('?') ? '&' : '?';
    res.redirect(cleanRef + cleanSep + 'toast_error=' + encodeURIComponent(msg));
}
`;

if (!code.includes('showToastError')) {
    code = code.replace('const express = require(', helper + '\nconst express = require(');
}

// Replace all res.status(401).send(...) and some common res.send(...) that throw login required
code = code.replace(/return res\.status\(401\)\.send\((['"`])(.+?)\1\);/g, 'return showToastError(req, res, $1$2$1);');
code = code.replace(/return res\.send\('Bu islem icin giris yapmaniz gerekiyor.'\);/g, "return showToastError(req, res, 'Bu işlem için giriş yapmanız gerekiyor.');");

fs.writeFileSync('server.js', code);
console.log('Replaced error responses');
