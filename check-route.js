const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/settlement/:id'"));
console.log(lines.slice(Math.max(0, idx - 10), idx + 20).join('\n'));
