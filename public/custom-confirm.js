let currentConfirmForm = null;

function customConfirm(event, formElement, messageText) {
    event.preventDefault();
    currentConfirmForm = formElement;
    
    let modal = document.getElementById('globalConfirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalConfirmModal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.3); z-index: 99999; justify-content: center; align-items: center;';
        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 16px; width: 90%; max-width: 350px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
                <div style="font-size: 40px; margin-bottom: 15px;">⚠️</div>
                <h3 style="color: #0f382c; margin-bottom: 10px; font-size: 18px;">Emin misiniz?</h3>
                <p id="globalConfirmMessage" style="color: #537066; font-size: 14px; margin-bottom: 25px; line-height: 1.5;">Bu işlemi onaylarsanız, değişiklikler uygulanacaktır.</p>
                <div style="display: flex; gap: 10px;">
                    <button type="button" id="globalCancelBtn" style="flex: 1; background: #f4f3ef; color: #0f382c; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">İptal</button>
                    <button type="button" id="globalConfirmBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">Evet, Onayla</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('globalCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
            currentConfirmForm = null;
        });

        document.getElementById('globalConfirmBtn').addEventListener('click', () => {
            if (currentConfirmForm) {
                if (currentConfirmForm.dataset.ajax === 'true') {
                    const event = new Event('submit', { cancelable: true, bubbles: true });
                    currentConfirmForm.dispatchEvent(event);
                    modal.style.display = 'none';
                    currentConfirmForm = null;
                } else {
                    currentConfirmForm.submit();
                }
            }
        });
    }

    document.getElementById('globalConfirmMessage').innerText = messageText;
    modal.style.display = 'flex';
}
