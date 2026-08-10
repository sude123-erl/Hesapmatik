const ejs = require('ejs');
const fs = require('fs');

const str = fs.readFileSync('views/activity-detail.ejs', 'utf8');

try {
    ejs.compile(str, { filename: 'views/activity-detail.ejs' });
    console.log('No errors!');
} catch (e) {
    console.error(e.message);
}
