const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

if (code.includes('/settlement/:id')) {
    console.log('Route already exists.');
    process.exit(0);
}

const lines = code.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("app.get('/activity/:id', (req, res) => {")) {
        startLine = i;
    }
    if (startLine !== -1 && i > startLine && lines[i].includes('// Etkinlik Görselini Güncelleme İşlemi')) {
        endLine = i;
        break;
    }
}

if (startLine !== -1 && endLine !== -1) {
    let routeLines = lines.slice(startLine, endLine);
    let routeCode = routeLines.join('\n');
    let newRouteCode = routeCode.replace("app.get('/activity/:id',", "app.get('/settlement/:id',").replace("res.render('activity-detail'", "res.render('settlement'");

    lines.splice(endLine, 0, "// Mahsuplasma Route", newRouteCode, "");

    fs.writeFileSync('server.js', lines.join('\n'));
    console.log('Successfully injected settlement route!');
} else {
    console.log('Could not find start or end line. startLine=' + startLine + ', endLine=' + endLine);
}
