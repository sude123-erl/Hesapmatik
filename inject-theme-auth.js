const fs = require('fs');
const files = ['views/login.ejs', 'views/register.ejs', 'views/forgot-password.ejs', 'views/reset-password.ejs'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let code = fs.readFileSync(file, 'utf8');
        if (!code.includes('<script src="/theme.js"></script>')) {
            code = code.replace('</title>', '</title>\n    <script src="/theme.js"></script>');
            fs.writeFileSync(file, code);
            console.log('Added theme.js to ' + file);
        }
    }
});
