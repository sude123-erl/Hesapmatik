const fs = require('fs');
const files = ['views/activity-detail.ejs', 'views/settlement.ejs', 'views/dashboard.ejs']; // any file that has the notifButton

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let code = fs.readFileSync(f, 'utf8');
    if (code.includes('id="notifButton"')) {
        // Add position relative if missing
        if (!code.includes('position: relative;') || !code.includes('id="notifButton"')) {
            code = code.replace(/id="notifButton"[\s]*style="/, 'id="notifButton" style="position: relative; ');
        }
        // Fix the badge position to be relative to the button instead of absolute to header
        code = code.replace(/top: 10px; right: 10px; background: #e74c3c/g, 'top: -5px; right: -5px; background: #e74c3c');
        code = code.replace(/top: 10px; right: 50px; background: rgba\(15, 56, 44, 0\.8\)/g, 'top: -5px; right: -5px; background: rgba(15, 56, 44, 0.8)');
        fs.writeFileSync(f, code);
    }
});
console.log('Fixed notifButton position styles');
