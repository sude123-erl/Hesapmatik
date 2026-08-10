const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'views');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ejs'));

files.forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');

    // Remove the overly aggressive div inline flex selector entirely
    content = content.replace(/\/\* Ozel Alan: Sag-Sol ayrilan kutular \(Orn: Kim odedi - Kime odedi\) \*\/[\s\S]*?div\[style\*=\"display: flex\"\], div\[style\*=\"display:flex\"\], div\[style\*=\"grid-template-columns\"\] \{[\s\S]*?width: 100% !important;\s*\}/g, '');

    // Remove .header-container, .top-bar, .grid from the flex-direction: column list so they stay side-by-side
    content = content.replace(/\.header-container, \.flex-row, \.grid, \.activities-grid, \.top-bar, \.list-item, \.expense-item, \.payment-item/g, '.flex-row, .activities-grid, .list-item, .expense-item, .payment-item');

    fs.writeFileSync(path.join(dir, f), content);
});
console.log('Fixed overly aggressive mobile CSS rules.');
