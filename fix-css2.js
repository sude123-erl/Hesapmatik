const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'views');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ejs'));

files.forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');

    // 1. Fix overflow
    content = content.replace(/overflow-x: hidden !important;/g, 'overflow-x: hidden !important;\n            overflow-y: auto !important;\n            height: auto !important;');

    // 2. Fix button 100% width
    content = content.replace(/input, select, textarea, button, \.btn, \.btn-primary, \.btn-danger, \.btn-secondary/g, 'input, select, textarea, .btn, .btn-primary, .btn-danger, .btn-secondary');

    // 3. Make the activity title slightly smaller on mobile
    if (f === 'activity-detail.ejs' || f === 'settlement.ejs') {
        content = content.replace(/h1, h2 \{[\s\S]*?width: 100% !important;\s*\}/g, 'h1, h2 {\n            font-size: 1.3rem !important;\n            text-align: left !important;\n        }');
    } else {
        content = content.replace(/h1, h2 \{[\s\S]*?width: 100% !important;\s*\}/g, 'h1, h2 {\n            font-size: 1.4rem !important;\n            text-align: center !important;\n        }');
    }

    fs.writeFileSync(path.join(dir, f), content);
});
console.log('Fixed mobile CSS bugs (scroll, button width, header alignment).');
