const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. add-payment redirect
code = code.replace(
    /res\.redirect\(\`\/activity\/\$\{activityId\}\`\);\s*\}\);\s*\}\);\s*\}\);\s*\}\);/g,
    `const referer = req.get('Referrer');
                    if (referer && referer.includes('/settlement/')) {
                        res.redirect(\`/settlement/\${activityId}\`);
                    } else {
                        res.redirect(\`/activity/\${activityId}\`);
                    }
                });
            });
        });
    });`
);

// 2. approve-payment redirect
code = code.replace(
    `res.redirect(req.body.returnTo === '/dashboard' ? '/dashboard' : \`/activity/\${payment.activityId}\`);`,
    `let redirectUrl = req.body.returnTo === '/dashboard' ? '/dashboard' : \`/activity/\${payment.activityId}\`;
                    const referer = req.get('Referrer');
                    if (req.body.returnTo !== '/dashboard' && referer && referer.includes('/settlement/')) {
                        redirectUrl = \`/settlement/\${payment.activityId}\`;
                    }
                    res.redirect(redirectUrl);`
);

// 3. delete-payment redirect
code = code.replace(
    /res\.redirect\(\`\/activity\/\$\{payment\.activityId\}\`\);\s*\}\);\s*\}\);\s*\}\);/g,
    `const referer = req.get('Referrer');
            if (referer && referer.includes('/settlement/')) {
                res.redirect(\`/settlement/\${payment.activityId}\`);
            } else {
                res.redirect(\`/activity/\${payment.activityId}\`);
            }
        });
    });
});`
);

fs.writeFileSync('server.js', code);
console.log('Fixed redirects!');
