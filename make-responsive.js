const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const ejsFiles = fs.readdirSync(viewsDir).filter(file => file.endsWith('.ejs'));

const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';

const responsiveCSS = `
    /* --- MOBIL UYUM (RESPONSIVE) EKLENTILERI --- */
    @media (max-width: 768px) {
        /* Sayfa Duzeni ve Tasmalar */
        body, html {
            overflow-x: hidden !important;
            width: 100% !important;
        }

        /* Konteynerlar */
        .container, .main-container, .panel-container, .content-container, .form-container, .card, .profile-container, .settings-container {
            width: 95% !important;
            max-width: 100% !important;
            padding: 15px !important;
            margin: 10px auto !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
        }

        /* Izgaralar ve Yatay Dizilimleri Dikeye Cevirme */
        .header-container, .flex-row, .grid, .activities-grid, .top-bar, .list-item, .expense-item, .payment-item {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            width: 100% !important;
            height: auto !important;
        }

        /* Ozel Alan: Sag-Sol ayrilan kutular (Orn: Kim odedi - Kime odedi) */
        div[style*="display: flex"], div[style*="display:flex"], div[style*="grid-template-columns"] {
            flex-direction: column !important;
            grid-template-columns: 1fr !important;
            width: 100% !important;
        }

        /* Butonlar, Inputlar, Selectler (iOS Zoom engeli icin font-size 16px) */
        input, select, textarea, button, .btn, .btn-primary, .btn-danger, .btn-secondary {
            width: 100% !important;
            font-size: 16px !important; 
            margin-top: 5px !important;
            margin-bottom: 5px !important;
            box-sizing: border-box !important;
            justify-content: center !important;
        }

        /* Modallar (Acilir Pencereler) */
        .modal-content, #expenseModal > div, #editExpenseModal > div {
            width: 95% !important;
            margin: 20px auto !important;
            padding: 20px !important;
            height: auto !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
        }

        /* Baslik Boyutlari */
        h1, h2 {
            font-size: 1.5rem !important;
            text-align: center !important;
            width: 100% !important;
        }
        h3 {
            font-size: 1.2rem !important;
        }

        /* Tablolar (Tasan tablolari kaydirilabilir yap) */
        table {
            display: block !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            width: 100% !important;
        }
    }
`;

let filesModified = 0;

ejsFiles.forEach(file => {
    const filePath = path.join(viewsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Viewport Ekleme
    if (!content.includes('name="viewport"')) {
        if (content.includes('<head>')) {
            content = content.replace('<head>', '<head>\n    ' + viewportTag);
            modified = true;
        } else if (content.includes('</title>')) {
            content = content.replace('</title>', '</title>\n    ' + viewportTag);
            modified = true;
        }
    }

    // 2. Responsive CSS Ekleme (</style> oncesine)
    if (!content.includes('MOBIL UYUM (RESPONSIVE) EKLENTILERI') && content.includes('</style>')) {
        // En son </style> etiketini bulup hemen oncesine yerlestir.
        const lastStyleIndex = content.lastIndexOf('</style>');
        content = content.substring(0, lastStyleIndex) + responsiveCSS + '\n' + content.substring(lastStyleIndex);
        modified = true;
    } else if (!content.includes('MOBIL UYUM (RESPONSIVE) EKLENTILERI') && !content.includes('</style>') && content.includes('</head>')) {
        // Hic style etiketi yoksa, head kapanmadan once yarat.
        content = content.replace('</head>', '<style>\n' + responsiveCSS + '\n</style>\n</head>');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
        filesModified++;
        console.log('Updated ' + file);
    }
});

console.log('\\nDone! Modified ' + filesModified + ' files.');
