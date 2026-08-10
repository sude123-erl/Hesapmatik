// Global fixes for mobile scroll and notifications
document.addEventListener('DOMContentLoaded', () => {
    // 1. Force enable scrolling globally (overrides any bad overflow:hidden in style.css or elsewhere)
    const style = document.createElement('style');
    style.innerHTML = `
        html, body {
            overflow: auto !important;
            overflow-x: hidden !important;
            height: auto !important;
            min-height: 100vh !important;
        }
        
        /* Ensure the modal clear button is above everything and clickable */
        .app-notifications__clear {
            position: relative;
            z-index: 9999;
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);

    // 2. Event delegation for Notifications Clear Button (Temizle)
    // In case the button was re-rendered and lost its event listener
    document.body.addEventListener('click', async (e) => {
        if (e.target.closest('.app-notifications__clear')) {
            e.preventDefault();
            try {
                const response = await fetch('/notifications/clear', { method: 'POST' });
                if (response.ok) {
                    const list = document.querySelector('.app-notifications__list');
                    const badge = document.querySelector('.app-notifications__badge');
                    if (list) list.innerHTML = '<div class="app-notifications__empty">Hiç bildiriminiz yok.</div>';
                    if (badge) badge.style.display = 'none';
                }
            } catch (err) {
                console.error("Bildirimler temizlenemedi:", err);
            }
        }

        // Also handle the individual delete buttons just in case
        if (e.target.closest('.app-notifications__delete')) {
            const btn = e.target.closest('.app-notifications__delete');
            const notifId = btn.dataset.id;
            if (notifId) {
                try {
                    const res = await fetch(`/notifications/delete/${notifId}`, { method: 'POST' });
                    if (res.ok) {
                        btn.closest('.app-notifications__item').remove();
                    }
                } catch (err) { console.error(err); }
            }
        }
    });
});
