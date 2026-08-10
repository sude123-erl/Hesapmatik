const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'views');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ejs'));

files.forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');

    // Remove justify-content: center !important; from all inputs
    content = content.replace(/justify-content: center !important;/g, '');

    // Add a specific fix for date inputs
    if (content.includes('input, select, textarea')) {
        const fixCSS = `
        input[type="date"], input[type="time"] {
            min-height: 48px !important;
            height: 48px !important;
            line-height: normal !important;
            padding: 10px !important;
            display: block !important;
            text-align: left !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            background-color: white !important;
        }`;

        // Let's just append it to the responsive style block if it exists
        if (content.includes('/* Mobil Stilleri Bitiş */')) {
            content = content.replace('/* Mobil Stilleri Bitiş */', fixCSS + '\n/* Mobil Stilleri Bitiş */');
        }
    }

    fs.writeFileSync(path.join(dir, f), content);
});
console.log('Fixed date inputs in CSS.');
