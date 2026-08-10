const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// Find the start of the DB block
const startIdx = code.indexOf("const db = new sqlite3.Database('./hesapmatik.db',");
if (startIdx !== -1) {
    // We know the block ends with "});" at line 150 before the "// Ana Sayfa" comment
    const endStr = "// Ana Sayfa";
    const endIdx = code.indexOf(endStr, startIdx);

    if (endIdx !== -1) {
        // Extract the exact block to replace
        const toReplace = code.substring(startIdx, endIdx);
        code = code.replace(toReplace, "const db = require('./config/db');\n\n");
        fs.writeFileSync('server.js', code);
        console.log('Successfully refactored DB connection out of server.js!');
    } else {
        console.log('Could not find the end of the DB block.');
    }
} else {
    console.log('Could not find the start of the DB block.');
}
