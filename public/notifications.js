(() => {
  const style = `
    .app-notifications{position:relative;z-index:1500}.app-notifications__button{width:42px;height:42px;border:0;border-radius:12px;background:#f1f5f9;color:#1e293b;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;transition:.2s}.app-notifications__button:hover{background:#e2e8f0;transform:translateY(-1px)}.app-notifications__button svg{width:21px;height:21px;fill:currentColor}.app-notifications__badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 5px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;border-radius:99px;background:#ef4444;color:#fff;font-size:10px;font-weight:700}.app-notifications__menu{position:absolute;top:calc(100% + 10px);right:0;width:min(330px,calc(100vw - 32px));overflow:hidden;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 16px 35px rgba(15,23,42,.16);opacity:0;visibility:hidden;transform:translateY(-6px);transition:.18s}.app-notifications.is-open .app-notifications__menu{opacity:1;visibility:visible;transform:translateY(0)}.app-notifications__header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #e2e8f0}.app-notifications__header strong{color:#1e293b;font-size:15px}.app-notifications__clear{border:0;background:none;color:#2563eb;font-size:12px;font-weight:700;cursor:pointer}.app-notifications__item{display:flex;gap:10px;padding:14px 16px;color:#475569;font-size:13px;line-height:1.4;border-bottom:1px solid #f1f5f9}.app-notifications__item.unread{background-color: #eff6ff}.app-notifications__item-icon{flex:0 0 30px;height:30px;display:grid;place-items:center;border-radius:50%;background:#eff6ff}.app-notifications__item p{margin:0}.app-notifications__item time{display:block;margin-top:3px;color:#94a3b8;font-size:11px}.app-notifications__empty{padding:24px 16px;text-align:center;color:#64748b;font-size:13px}`;

  const markup = `
    <div class="app-notifications">
      <button class="app-notifications__button" type="button" aria-label="Bildirimleri aç" aria-expanded="false">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.4 2.4 0 0 0 2.38-2H9.62A2.4 2.4 0 0 0 12 22Zm7-5-1.7-2.1V10a5.3 5.3 0 0 0-4.1-5.16V4a1.2 1.2 0 0 0-2.4 0v.84A5.3 5.3 0 0 0 6.7 10v4.9L5 17v1.2h14V17Z"/>
        </svg>
        <span class="app-notifications__badge" style="display: none;">0</span>
      </button>
      <section class="app-notifications__menu" aria-label="Bildirimler">
        <div class="app-notifications__header">
          <strong>Bildirimler</strong>
          <button class="app-notifications__clear" type="button">Temizle</button>
        </div>
        <div class="app-notifications__list">
          <div class="app-notifications__empty">Yükleniyor...</div>
        </div>
      </section>
    </div>
  `;

  const init = () => {
    if (!document.getElementById('app-notifications-style')) {
      const tag = document.createElement('style');
      tag.id = 'app-notifications-style';
      tag.textContent = style;
      document.head.appendChild(tag);
    }

    document.querySelectorAll('[data-notification-host]').forEach((host) => {
      host.outerHTML = markup;
    });

    document.querySelectorAll('.app-notifications').forEach((widget) => {
      if (widget.dataset.ready) return;
      widget.dataset.ready = 'true';

      const toggle = widget.querySelector('.app-notifications__button');
      const badge = widget.querySelector('.app-notifications__badge');
      const list = widget.querySelector('.app-notifications__list');
      const clear = widget.querySelector('.app-notifications__clear');

      const fetchNotifications = async () => {
        try {
          const res = await fetch('/api/notifications');
          const data = await res.json();
          if (data.success) {
            renderNotifications(data.notifications);
          }
        } catch (err) {
          console.error('Bildirimler yüklenemedi:', err);
        }
      };

      const renderNotifications = (notifications) => {
        if (!notifications || notifications.length === 0) {
          badge.style.display = 'none';
          list.innerHTML = '<div class="app-notifications__empty">Henüz bir bildiriminiz yok.</div>';
          return;
        }

        const unreadCount = notifications.filter(n => n.isRead === 0).length;
        if (unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }

        list.innerHTML = notifications.map(n => `
          <div class="app-notifications__item ${n.isRead === 0 ? 'unread' : ''}">
            <span class="app-notifications__item-icon">🔔</span>
            <div>
              <p>${n.message}</p>
              <time>${new Date(n.createdAt || Date.now()).toLocaleDateString('tr-TR')} ${new Date(n.createdAt || Date.now()).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</time>
            </div>
          </div>
        `).join('');
      };

      const clearNotifications = async () => {
        try {
          const res = await fetch('/api/notifications/clear', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            badge.style.display = 'none';
            // Bildirimleri tekrar çekip okundu olarak güncel halini gösterelim
            fetchNotifications();
          }
        } catch (err) {
          console.error('Bildirimler temizlenirken hata:', err);
        }
      };

      // İlk yükleme
      fetchNotifications();

      // Menüyü açıp kapama
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = widget.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open);
        if (open) {
          fetchNotifications();
          
          if (badge.style.display !== 'none') {
            badge.style.display = 'none';
            fetch('/api/notifications/clear', { method: 'POST' }).catch(err => console.error(err));
          }
        }
      });

      // Temizleme işlemi
      clear.addEventListener('click', (event) => {
        event.stopPropagation();
        clearNotifications();
      });

      // Dışarı tıklayınca kapatma
      document.addEventListener('click', (event) => {
        if (!widget.contains(event.target)) {
          widget.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
