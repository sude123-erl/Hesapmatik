const fs = require('fs');

const activityPath = 'views/activity-detail.ejs';
let content = fs.readFileSync(activityPath, 'utf8');

// Replace the anchor tag with a button
content = content.replace(
    /<a href="\/add-expense\?activityId=<%=\s*activity\._id\s*\|\|\s*activity\.id\s*%>" class="btn-add-expense">\+ Yeni\s*harcama ekle<\/a>/,
    '<button type="button" onclick="openExpenseModal()" class="btn-add-expense">+ Yeni harcama ekle</button>'
);

const modalHTML = `
    <!-- Harcama Ekle Modali -->
    <div id="expenseModal"
        style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px); z-index: 2000; justify-content: center; align-items: center; overflow-y: auto;">
        <div class="card"
            style="background: var(--bg-card, #f4f3ef); padding: 25px; border-radius: 20px; width: 90%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid var(--border-color, rgba(15, 56, 44, 0.15)); max-height: 90vh; overflow-y: auto; margin: auto;">
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 20px; color: var(--text-primary, #0f382c); font-weight: 800;">Harcama Ekle</h2>
                <button type="button" onclick="closeExpenseModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary, #537066);">&times;</button>
            </div>
            
            <form action="/add-expense" method="POST" enctype="multipart/form-data">
                <input type="hidden" name="activityId" value="<%= typeof activity !== 'undefined' ? (activity._id || activity.id) : '' %>">
                <input type="hidden" name="amount" id="modalAmountInput" value="0">
                
                <div style="border: 2px solid var(--border-color-hover, #0f382c); border-radius: 14px; padding: 16px; text-align: right; font-size: 32px; font-weight: 800; color: var(--text-primary, #0f382c); margin-bottom: 16px; background: var(--bg-input, #ffffff); cursor: pointer; transition: all 0.2s ease;" id="modalAmountDisplay">0,00</div>
                
                <div style="margin-bottom: 16px;">
                    <input type="text" name="expenseName" required placeholder="Harcama Adı: Örn. market, benzin" style="width: 100%; padding: 12px 16px; border: 1.5px solid var(--border-color, rgba(15, 56, 44, 0.2)); border-radius: 12px; font-size: 14px; font-weight: 600; outline: none; background: var(--bg-input, #ffffff); color: var(--text-primary);">
                </div>
                
                <div style="margin-bottom: 16px;">
                    <input type="file" name="receipt" id="modalReceiptInput" multiple style="width: 100%; padding: 8px 12px; font-size: 13px; cursor: pointer;">
                    <div id="modalFileList" style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;"></div>
                </div>
                
                <div id="modalKeypad" style="display: none; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
                    <button type="button" class="key-btn" onclick="modalPressKey('1')">1</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('2')">2</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('3')">3</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('4')">4</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('5')">5</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('6')">6</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('7')">7</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('8')">8</button>
                    <button type="button" class="key-btn" onclick="modalPressKey('9')">9</button>
                    <div></div>
                    <button type="button" class="key-btn" onclick="modalPressKey('0')">0</button>
                    <button type="button" class="key-btn" onclick="modalDeleteKey()">⌫</button>
                </div>
                
                <button type="submit" id="modalSubmitBtn" style="width: 100%; background: rgba(15, 56, 44, 0.3); color: #ffffff; border: none; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: not-allowed; transition: all 0.2s ease;">Harcama Ekle</button>
            </form>
        </div>
    </div>
`;

const modalJS = `
<script>
    let modalCurrentAmount = "0";
    let modalSelectedFiles = [];
    
    function openExpenseModal() {
        document.getElementById('expenseModal').style.display = 'flex';
        modalCurrentAmount = "0";
        modalSelectedFiles = [];
        modalUpdateDisplay();
        modalUpdateFileList();
    }
    
    function closeExpenseModal() {
        document.getElementById('expenseModal').style.display = 'none';
        document.getElementById('modalKeypad').style.display = 'none';
    }

    document.getElementById('modalAmountDisplay').addEventListener('click', function () {
        document.getElementById('modalKeypad').style.display = 'grid';
    });

    document.getElementById('modalReceiptInput').addEventListener('change', function (e) {
        const files = Array.from(e.target.files);
        files.forEach(file => modalSelectedFiles.push(file));
        modalUpdateFileList();
    });

    function modalRemoveFile(index) {
        modalSelectedFiles.splice(index, 1);
        modalUpdateFileList();
    }

    function modalUpdateFileList() {
        const fileListContainer = document.getElementById('modalFileList');
        const receiptInput = document.getElementById('modalReceiptInput');
        fileListContainer.innerHTML = '';
        const dataTransfer = new DataTransfer();
        modalSelectedFiles.forEach((file, index) => {
            dataTransfer.items.add(file);
            const fileItem = document.createElement('div');
            fileItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: var(--bg-input, #ffffff); border: 1px solid rgba(15, 56, 44, 0.15); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-primary, #0f382c);';
            fileItem.innerHTML = \`<span>\${file.name}</span><button type="button" onclick="modalRemoveFile(\${index})" style="background: #fee2e2; color: #ef4444; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 14px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>\`;
            fileListContainer.appendChild(fileItem);
        });
        receiptInput.files = dataTransfer.files;
    }

    function modalPressKey(num) {
        if (modalCurrentAmount === "0") modalCurrentAmount = num;
        else modalCurrentAmount += num;
        modalUpdateDisplay();
    }

    function modalDeleteKey() {
        if (modalCurrentAmount.length > 1) modalCurrentAmount = modalCurrentAmount.slice(0, -1);
        else modalCurrentAmount = "0";
        modalUpdateDisplay();
    }

    function modalUpdateDisplay() {
        const amountDisplay = document.getElementById('modalAmountDisplay');
        let displayVal = (parseInt(modalCurrentAmount) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        amountDisplay.innerText = displayVal;
        document.getElementById('modalAmountInput').value = (parseInt(modalCurrentAmount) / 100).toFixed(2);

        const submitBtn = document.getElementById('modalSubmitBtn');
        if (parseInt(modalCurrentAmount) > 0) {
            submitBtn.style.background = 'var(--btn-primary-bg, #0f382c)';
            submitBtn.style.cursor = 'pointer';
        } else {
            submitBtn.style.background = 'rgba(15, 56, 44, 0.3)';
            submitBtn.style.cursor = 'not-allowed';
        }
    }
</script>
`;

if (!content.includes('id="expenseModal"')) {
    content = content.replace('<!-- Fiş Büyütme Modali -->', modalHTML + '\n    <!-- Fiş Büyütme Modali -->');
    content = content.replace('</body>', modalJS + '\n</body>');
    fs.writeFileSync(activityPath, content);
    console.log('Expense modal injected.');
} else {
    console.log('Expense modal already exists.');
}
