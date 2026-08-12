(function () {
    // Sayfa yüklenir yüklenmez temayı uygula (flash etkisini önlemek için head içine konmalıdır)
    const savedTheme = localStorage.getItem('hesapmatik-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark-mode');
    }

    // DOM yüklendikten sonra butonları ayarla
    window.addEventListener('DOMContentLoaded', () => {
        // Eğer body'de yoksa, html'den body'ye de taşı
        if (document.documentElement.classList.contains('dark-mode')) {
            document.body.classList.add('dark-mode');
        }

        const themeBtns = document.querySelectorAll('.theme-toggle-btn');

        function updateIcons() {
            const isDark = document.body.classList.contains('dark-mode');
            themeBtns.forEach(btn => {
                if (isDark) {
                    btn.innerHTML = '☀️';
                } else {
                    btn.innerHTML = '🌙';
                }
            });
        }

        // İlk ikon durumlarını ayarla
        updateIcons();

        // Buton tıklama olayları
        themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                document.documentElement.classList.toggle('dark-mode');

                const isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('hesapmatik-theme', isDark ? 'dark' : 'light');
                updateIcons();

                // Eğer Chart.js grafiği varsa renklerini güncelle
                if (typeof initChart === 'function') {
                    // Grafiğin yeniden çizilmesi için kısa bir gecikme verilebilir
                    setTimeout(initChart, 50);
                }
            });
        });
    });

    // Sayfada toast_error veya toast_success parametresi varsa uyarı mesajı göster ve URL'den temizle
    window.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const errorMsg = urlParams.get('toast_error');
        const successMsg = urlParams.get('toast_success');

        if (errorMsg || successMsg) {
            const isSuccess = !!successMsg;
            const msg = isSuccess ? successMsg : errorMsg;

            // Basit bir mini kart (toast) oluştur ve ekrana ekle
            const toast = document.createElement('div');
            toast.style.cssText = `position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: ${isSuccess ? '#27ae60' : '#e74c3c'}; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 600; font-size: 14px; z-index: 999999; box-shadow: 0 4px 12px rgba(0,0,0,0.2); opacity: 0; transition: opacity 0.3s, transform 0.3s; pointer-events: none; text-align: center;`;
            toast.textContent = msg;
            document.body.appendChild(toast);

            // Animasyonla göster
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translate(-50%, -10px)';
            });

            // 3 saniye sonra gizle ve URL'den sil
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, 0)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);

            // URL'i temizle
            const paramToRemove = isSuccess ? 'toast_success' : 'toast_error';
            const newUrl = window.location.pathname + window.location.search.replace(new RegExp('([?&])' + paramToRemove + '=[^&]*(&|$)'), function (m, p1, p2) {
                return p1 === '?' || p2 === '' ? p1 : '&';
            }).replace(/\?$/, '');
            window.history.replaceState({}, document.title, newUrl);
        }
    });
})();

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

    // Prevent double submission on all forms globally
    document.addEventListener('submit', (e) => {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
            setTimeout(() => {
                submitBtn.disabled = true;
                if (submitBtn.tagName === 'BUTTON' && !submitBtn.innerText.includes('...')) {
                    const txt = submitBtn.innerText.trim().toLowerCase();
                    let loadingText = 'Kaydediliyor...';
                    if (txt.includes('giriş')) {
                        loadingText = 'Giriş yapılıyor...';
                    } else if (txt.includes('kaydol') || txt.includes('kayıt')) {
                        loadingText = 'Kaydolunuyor...';
                    } else if (txt.includes('sil') || txt.includes('çıkar')) {
                        loadingText = 'Siliniyor...';
                    } else if (txt.includes('gönder') || txt.includes('şifre')) {
                        loadingText = 'Lütfen bekleyin...';
                    }
                    submitBtn.innerText = loadingText;
                }
            }, 10);
        }
    });
});
