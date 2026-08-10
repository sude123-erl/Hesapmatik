const http = require('http');

setTimeout(() => {
    http.get('http://localhost:2024/settlement/6', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Response status:', res.statusCode);
            if (res.statusCode >= 500) {
                console.log('Response body:', data.substring(0, 1000));
            } else {
                console.log('Success, response length:', data.length);
            }
            process.exit(0);
        });
    }).on('error', (err) => {
        console.error('Request error:', err.message);
        process.exit(1);
    });
}, 2000);

require('./server.js');
