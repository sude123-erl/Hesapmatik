const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// Require dotenv and rateLimit at the top
if (!code.includes("require('dotenv')")) {
    code = code.replace(
        "const express = require('express');",
        "require('dotenv').config();\nconst express = require('express');\nconst rateLimit = require('express-rate-limit');"
    );
}

// Replace session secret
code = code.replace(
    "secret: 'gizli-anahtar-kelime'",
    "secret: process.env.SESSION_SECRET || 'gizli-anahtar-kelime'"
);

// Replace SMTP settings
code = code.replace(
    "user: 'saadetsudegunes31.@gmail.com'",
    "user: process.env.SMTP_USER || 'saadetsudegunes31.@gmail.com'"
);
code = code.replace(
    "pass: 'ycprxvmvcoagxveb'",
    "pass: process.env.SMTP_PASS || 'ycprxvmvcoagxveb'"
);

// Replace PORT
code = code.replace(
    "const PORT = 2024;",
    "const PORT = process.env.PORT || 2024;"
);

// Add rate limiter for auth routes
if (!code.includes('authLimiter')) {
    const authLimiterCode = `
// Rate Limiter for Auth Routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: 'Çok fazla giriş denemesi yaptınız, lütfen daha sonra tekrar deneyin.'
});

app.use('/login', authLimiter);
app.use('/register', authLimiter);
app.use('/forgot-password', authLimiter);
app.use('/reset-password', authLimiter);
`;
    code = code.replace(
        "app.set('views', path.join(__dirname, 'views'));",
        "app.set('views', path.join(__dirname, 'views'));\n" + authLimiterCode
    );
}

fs.writeFileSync('server.js', code);
console.log('Security patches applied!');
