/**
 * WanderViệt Shared UI Logic
 * Theme, Toast, Notifications, Rank Badges, Common Modals
 */

window.WanderUI = Object.assign(window.WanderUI || {}, (function () {
  'use strict';

  const STORAGE_THEME = 'wander_theme';

  // ─── Global Fetch Interceptor for Suspension ─────────────────────────────
  const originalFetch = window.fetch;
  function openModal(name) {
    const m = document.querySelector('[data-modal="' + name + '"]');
    if (!m) return;
    m.hidden = false;
    const backdrop = document.querySelector('[data-modal-backdrop]');
    if (backdrop) backdrop.hidden = false;
    if (m.classList.contains('slide-drawer')) {
      requestAnimationFrame(() => m.classList.add('is-open'));
    }
  }
  window.openModal = openModal;

  function closeModal(m) {
    if (typeof m === 'string') m = document.querySelector('[data-modal="' + m + '"]');
    if (!m) return;
    if (m.classList.contains('slide-drawer')) {
      m.classList.remove('is-open');
      setTimeout(() => { m.hidden = true; }, 300);
    } else {
      m.hidden = true;
    }
    const backdrop = document.querySelector('[data-modal-backdrop]');
    if (backdrop) backdrop.hidden = true;
    document.documentElement.style.overflow = "";
  }
  window.closeModal = closeModal;
  window.closeModals = () => {
    document.querySelectorAll('.modal').forEach(m => closeModal(m));
  };

  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');

    // Big-Tech Pattern: Check prefetch cache first (Skip for dynamic user state)
    const cacheKey = 'wv_prefetch_' + url;
    const isDynamic = url.includes('/api/auth/user/rank') || url.includes('/api/auth/me');
    const cached = isDynamic ? null : sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 15000) { // 15s fresh
          console.log(`🎯 Fast-Path: Using prefetched data for ${url}`);
          // Don't remove immediately to allow multiple consumption if needed (e.g. stats)
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'x-prefetched': 'true' }
          });
        }
      } catch (e) { }
    }

    const response = await originalFetch.apply(this, args);

    if (response.status === 403 || response.status === 401) {
      try {
        const clone = response.clone();
        const data = await clone.json();

        if (response.status === 403 && data && data.message && data.message.includes('bị khóa')) {
          showSuspendedModal();
        }

        if (response.status === 401 && !url.includes('/login') && !url.includes('/register')) {
          localStorage.removeItem('wander_token');
          localStorage.removeItem('wander_admin_token');
        }
      } catch (e) { /* ignore parse error */ }
    }

    return response;
  };

  function showSuspendedModal() {
    let modal = document.getElementById('wander-suspended-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wander-suspended-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);';
      modal.innerHTML = `
        <div style="background:var(--bg-elevated,#1e293b);border-radius:24px;width:min(400px,90vw);padding:2.5rem 2rem;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.5);border:1px solid rgba(244,63,94,0.4);">
          <div style="font-size:3.5rem;margin-bottom:1rem;filter:drop-shadow(0 0 12px rgba(244,63,94,0.5));">🔒</div>
          <h2 style="color:#f43f5e;margin:0 0 1rem 0;font-size:1.6rem;font-weight:700;">Tài khoản bị khóa</h2>
          <p style="color:var(--text-muted,#94a3b8);margin:0 0 2rem 0;line-height:1.6;font-size:0.95rem;">Tài khoản của bạn đã bị quản trị viên khóa do phát hiện dấu hiệu vi phạm chính sách của WanderViệt. Vui lòng đăng xuất.</p>
          <button onclick="WanderUI.forceLogout()" style="background:#f43f5e;color:white;border:none;padding:0.9rem 2rem;border-radius:12px;font-weight:600;font-size:1.05rem;cursor:pointer;width:100%;transition:all 0.2s;box-shadow:0 8px 24px rgba(244,63,94,0.3);">Đăng Xuất Ngay</button>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
  }

  function forceLogout() {
    localStorage.removeItem('wander_token');
    localStorage.removeItem('wander_session');
    sessionStorage.clear();
    window.location.href = '/?login=true';
  }

  // ─── Theme ───────────────────────────────────────────────────────────────
  function setTheme(theme, syncWithBackend = false) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME, theme);
    if (syncWithBackend) {
      const token = localStorage.getItem('wander_token') || localStorage.getItem('wander_admin_token');
      if (token) {
        fetch('/api/auth/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ theme })
        }).catch(err => console.debug('Sync theme failed:', err));
      }
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved) setTheme(saved);
    else setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  // ─── Toast ───────────────────────────────────────────────────────────────
  function getToastContainer() {
    let c = document.getElementById('wander-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'wander-toast-container';
      c.style.cssText = 'position:fixed;bottom:2rem;right:2rem;display:flex;flex-direction:column;gap:0.75rem;z-index:99999;pointer-events:none;';
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(message, type = 'info') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `wander-toast wander-toast--${type}`;
    toast.innerHTML = `<div class="wander-toast__content">${message}</div><button class="wander-toast__close">&times;</button>`;
    container.appendChild(toast);
    toast.querySelector('.wander-toast__close').onclick = () => toast.remove();
    setTimeout(() => {
      toast.classList.add('wander-toast--fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // ─── Button Loading ───────────────────────────────────────────────────────
  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.classList.add('btn-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────
  let lastNotifCount = -1;
  async function updateNotificationBadge() {
    const token = localStorage.getItem('wander_token') || localStorage.getItem('wander_admin_token');
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/unread-count', { headers: { 'x-auth-token': token } });
      if (res.status === 401) {
        return;
      }
      const json = await res.json();

      // Show toast if count increased
      if (lastNotifCount !== -1 && json.count > lastNotifCount) {
        WanderUI.showToast('Bạn có thông báo mới!', 'info');
        // Optional: Play a subtle sound
      }
      lastNotifCount = json.count;

      const badge = document.querySelector('[data-notif-badge]');
      if (badge) {
        if (json.count > 0) {
          badge.textContent = json.count > 20 ? '20+' : json.count;
          badge.style.display = 'flex';
          badge.classList.add('pulse-notif');
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) { }
  }

  // Start polling
  setInterval(updateNotificationBadge, 60000); // Check every 1 minute instead of 30s
  setTimeout(updateNotificationBadge, 3000);

  function toggleNotificationDrawer() {
    const drawer = document.getElementById('wander-notif-drawer') || createNotificationDrawer();
    const isOpen = drawer.classList.contains('is-open');
    if (!isOpen) {
      renderNotifications();
      drawer.style.display = 'flex';
      requestAnimationFrame(() => drawer.classList.add('is-open'));
    } else {
      drawer.classList.remove('is-open');
      setTimeout(() => { drawer.style.display = 'none'; }, 300);
    }
  }

  function createNotificationDrawer() {
    const drawer = document.createElement('div');
    drawer.id = 'wander-notif-drawer';
    drawer.className = 'wander-notif-drawer slide-drawer';
    drawer.innerHTML = `
      <div class="wander-notif-drawer__header">
        <h3>Thông báo</h3>
        <button class="wander-notif-drawer__close" onclick="WanderUI.toggleNotificationDrawer()">×</button>
      </div>
      <div class="wander-notif-drawer__body" id="wander-notif-body">
         <div class="notif-loading">Đang tải thông báo...</div>
      </div>
      <div class="wander-notif-drawer__footer">
        <button onclick="WanderUI.markAllAsRead()" class="btn btn--ghost btn--small">Đánh dấu tất cả đã đọc</button>
      </div>
    `;
    document.body.appendChild(drawer);
    injectNotifStyles();
    return drawer;
  }

  function injectNotifStyles() {
    if (document.getElementById('notif-styles')) return;
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.textContent = `
      .wander-notif-drawer {
        position: fixed; top: 0; right: 0; bottom: 0; width: 380px; 
        background: var(--bg-elevated); border-left: 1px solid var(--border);
        z-index: 10000; display: none; flex-direction: column;
        box-shadow: -10px 0 30px rgba(0,0,0,0.3); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform: translateX(100%);
      }
      .wander-notif-drawer.is-open { transform: translateX(0); }
      .wander-notif-drawer__header { 
        padding: 1.5rem; border-bottom: 1px solid var(--border);
        display: flex; justify-content: space-between; align-items: center;
      }
      .wander-notif-drawer__body { flex: 1; overflow-y: auto; }
      .wander-notif-drawer__footer { padding: 1rem; border-top: 1px solid var(--border); text-align: center; }
      .wander-notif-item {
        padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.03);
        cursor: pointer; transition: background 0.2s; position: relative;
      }
      .wander-notif-item:hover { background: rgba(255,255,255,0.03); }
      .wander-notif-item.is-unread { background: rgba(0, 240, 255, 0.03); }
      .wander-notif-item.is-unread::before {
        content: ''; position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
        width: 6px; height: 6px; background: var(--accent); border-radius: 50%;
      }
      .wander-notif-item__title { font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; color: var(--text); }
      .wander-notif-item__message { font-size: 0.88rem; color: var(--text-muted); line-height: 1.4; }
      .wander-notif-item__time { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; opacity: 0.6; }
      .pulse-notif { animation: pulse-ring 2s infinite; }
      @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(0, 240, 255, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(0, 240, 255, 0); } 100% { box-shadow: 0 0 0 0 rgba(0, 240, 255, 0); } }
    `;
    document.head.appendChild(style);
  }

  async function markAllAsRead() {
    const token = localStorage.getItem('wander_token') || localStorage.getItem('wander_admin_token');
    await fetch('/api/notifications/read-all', { method: 'POST', headers: { 'x-auth-token': token } });
    renderNotifications();
    updateNotificationBadge();
  }

  async function renderNotifications() {
    const body = document.getElementById('wander-notif-body');
    if (!body) return;
    const token = localStorage.getItem('wander_token') || localStorage.getItem('wander_admin_token');
    const res = await fetch('/api/notifications', { headers: { 'x-auth-token': token } });
    const json = await res.json();
    if (!json.success || !json.data.length) {
      body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">Không có thông báo mới</div>';
      return;
    }
    body.innerHTML = json.data.map(n => `
      <div class="wander-notif-item ${n.isRead ? '' : 'is-unread'}" onclick="WanderUI.markAsRead('${n._id}', '${n.link}')">
        <div class="wander-notif-item__title">${n.title}</div>
        <div class="wander-notif-item__message">${n.message}</div>
        <div class="wander-notif-item__time">${new Date(n.createdAt).toLocaleString('vi-VN')}</div>
      </div>
    `).join('');
  }

  async function markAsRead(id, link) {
    const token = localStorage.getItem('wander_token') || localStorage.getItem('wander_admin_token');
    await fetch(`/api/notifications/read/${id}`, { method: 'PUT', headers: { 'x-auth-token': token } });
    updateNotificationBadge();
    if (link) window.location.href = link;
    else renderNotifications();
  }

  // ─── Rank ──────────────────────────────────────────────────────────
  function getRankIcon(rank) {
    if (rank.includes('Đồng')) return '🥉';
    if (rank.includes('Bạc')) return '🥈';
    if (rank.includes('Vàng')) return '🥇';
    if (rank.includes('Bạch Kim')) return '💎';
    if (rank.includes('Kim Cương')) return '💠';
    if (rank.includes('Huyền Thoại')) return '👑';
    return '🏅';
  }

  function getRankBadgeHTML(rank, tier) {
    if (!rank) return '';
    const tierKey = (tier === 'I' || tier === '1') ? '1' : (tier === 'II' || tier === '2') ? '2' : (tier === 'III' || tier === '3') ? '3' : '1';
    let rankClass = 'rank-bronze-1';
    if (rank.includes('Bạch Kim')) rankClass = `rank-platinum-${tierKey}`;
    else if (rank.includes('Bạc')) rankClass = `rank-silver-${tierKey}`;
    else if (rank.includes('Đồng')) rankClass = `rank-bronze-${tierKey}`;
    else if (rank.includes('Vàng')) rankClass = `rank-gold-${tierKey}`;
    else if (rank.includes('Kim Cương')) rankClass = `rank-diamond-${tierKey}`;
    else if (rank.includes('Huyền Thoại')) rankClass = 'rank-legendary';
    return `<div class="rank-badge-container" style="display:inline-flex; align-items:center;">
      <div class="rank-sprite ${rankClass}"></div>
    </div>`;
  }

  function getStoreKey(base) {
    return 'wv_' + base;
  }

  function trackQuestActivity(key, value) {
    try {
      var storeKey = getStoreKey('quest_activity');
      var data = JSON.parse(localStorage.getItem(storeKey) || '{}');
      var d = new Date();
      var today = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      if (data.date !== today) {
        data = { date: today };
      }
      data[key] = Math.max(data[key] || 0, value || 1);
      localStorage.setItem(storeKey, JSON.stringify(data));
    } catch (e) { }
  }

  function getQuestActivity(key) {
    try {
      var storeKey = getStoreKey('quest_activity');
      var data = JSON.parse(localStorage.getItem(storeKey) || '{}');
      var d = new Date();
      var today = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      if (data.date !== today) return 0;
      return data[key] || 0;
    } catch (e) { return 0; }
  }

  // ─── Auth Sync ──────────────────────────────────────────────────
  function toggleUserMenu(open) {
    const userToggle = document.querySelector('[data-user-toggle]');
    const dd = document.querySelector('[data-user-dropdown]');
    if (!userToggle || !dd) return;
    if (open) {
      dd.hidden = false;
      dd.style.display = 'block';
      userToggle.setAttribute("aria-expanded", "true");
    } else {
      dd.hidden = true;
      dd.style.display = 'none';
      userToggle.setAttribute("aria-expanded", "false");
    }
  }


  let syncInProgress = false;
  let lastSyncTime = 0;
  const SYNC_THROTTLE = 5000; // 5 seconds

  async function syncAuthUI() {
    if (syncInProgress) return;
    const now = Date.now();
    if (now - lastSyncTime < SYNC_THROTTLE) return;

    syncInProgress = true;
    lastSyncTime = now;

    const token = localStorage.getItem('wander_token');
    const authBtns = document.querySelectorAll("[data-auth-open]");
    const profileTrays = document.querySelectorAll("[data-auth-show]");
    const userNameEl = document.querySelector("[data-user-name]");
    const userAvatarImg = document.querySelector("[data-user-avatar]");
    const userInitial = document.querySelector("[data-user-initial]");
    const headerRankEl = document.getElementById('header-user-rank');

    if (!token) {
      authBtns.forEach(el => el.style.display = "flex");
      profileTrays.forEach(el => { el.style.display = "none"; el.hidden = true; });
      if (headerRankEl) headerRankEl.style.display = "none";
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - base64.length % 4) % 4);
      const payload = JSON.parse(decodeURIComponent(escape(atob(base64 + padding))));
      const u = payload.user || payload.account || payload;

      authBtns.forEach(el => el.style.display = "none");
      profileTrays.forEach(el => { el.style.display = "flex"; el.removeAttribute('hidden'); });

      const initialName = u.displayName || u.name || "User";
      if (userNameEl) userNameEl.textContent = initialName;
      if (userInitial) {
        userInitial.textContent = initialName.charAt(0).toUpperCase();
        userInitial.style.display = 'flex';
      }
      if (userAvatarImg) userAvatarImg.setAttribute('hidden', '');

      // Standardize Dropdown Body
      const ddBody = document.querySelector('.user-dropdown__body');
      if (ddBody) {
        ddBody.innerHTML = `
          <button type="button" class="user-dropdown-item" data-open-settings>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Cài đặt hệ thống
          </button>
          <div style="border-top:1px solid rgba(255,255,255,0.05); margin:0.5rem 0;"></div>
          <button type="button" class="user-dropdown-item user-dropdown-item--danger" data-logout-btn>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Đăng xuất
          </button>
        `;
      }

      try {
        const r = await fetch('/api/auth/user/rank?t=' + Date.now(), { headers: { 'x-auth-token': token } });
        if (r.status === 401) {
          localStorage.removeItem('wander_token');
          return;
        }
        const data = await r.json();
        if (data && data.success) {
          const fullDis = data.displayName || data.name || initialName;
          if (userNameEl) {
            userNameEl.innerHTML = `
               <div style="display:flex; flex-direction:column; line-height:1.2;">
                 <span style="font-weight:700; color:#fff; font-size:0.95rem;">${fullDis.replace(/</g, '&lt;')}</span>
                 <span style="font-size:0.7rem; color:var(--text-muted); opacity:0.8;">${data.customId || ""}</span>
                 <span style="font-size:0.7rem; color:var(--text-muted);">${(data.email || u.email || "").replace(/</g, '&lt;')}</span>
               </div>
             `;
          }
          if (userAvatarImg && data.avatar) {
            userAvatarImg.src = data.avatar;
            userAvatarImg.style.display = 'block';
            userAvatarImg.removeAttribute('hidden');
            if (userInitial) userInitial.style.display = 'none';
          }
          if (headerRankEl) {
            headerRankEl.innerHTML = getRankBadgeHTML(data.rank, data.rankTier);
            headerRankEl.style.display = 'flex';
            headerRankEl.style.alignItems = 'center';
          }
        }
      } catch (err) {
        console.error("Auth sync API error:", err);
      }

    } catch (e) {
      console.error("Auth sync error", e);
    } finally {
      syncInProgress = false;
    }
  }

  // Big-Tech: One-time global listener for auth-related actions
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-profile]')) {
      window.location.href = 'profile.html';
    }
    if (e.target.closest('[data-logout-btn]')) {
      WanderUI.forceLogout();
    }
    if (e.target.closest('[data-open-activity]')) {
      WanderUI.openModal('activity-stats');
    }
  });

  const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isExplorer = page === 'index.html' || page === '';
  const isSocial = page.includes('social');
  const isServices = page.includes('leaderboard') || page.includes('voucher') || page.includes('services');
  const isQuests = page.includes('quests');
  const isHistory = page.includes('history');

  function injectHeader() {
    console.log("🛠️ WanderUI: Injecting Header...");
    const container = document.getElementById('header-container') || document.querySelector('[data-header]') || document.querySelector('.site-header') || document.querySelector('header');
    if (!container) {
      console.error("❌ WanderUI: Header container NOT found!");
      return;
    }

    container.innerHTML = `
      <div class="header-inner">
        <div class="header-left">
          <a href="index.html" class="logo">
            <span class="logo-mark">◈</span>
            WanderViệt
          </a>
        </div>

        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
          <span class="nav-toggle-bar"></span>
          <span class="visually-hidden">Mở menu</span>
        </button>
        
        <div class="nav-overlay" data-nav-overlay></div>
        <nav id="site-nav" class="site-nav" data-nav>
          <div class="site-nav__mobile-head">
             <div class="site-nav__mobile-logo">
                <span class="logo-mark">◈</span>
                <div class="site-nav__mobile-title">
                   <strong>WanderViệt</strong>
                   <span>Khám phá • Trải nghiệm</span>
                </div>
             </div>
          </div>
          <ul class="nav-list">
             <li><a href="index.html" class="nav-link" data-link="home">🏠 Trang chủ</a></li>
             <li><a href="index.html#destinations" class="nav-link" data-link="destinations">🗺️ Điểm đến</a></li>
             <li><a href="my-trips.html" class="nav-link" data-link="my-trips">📅 Chuyến đi</a></li>
             <li><a href="planner.html" class="nav-link" data-link="ai-planner">🤖 AI Trợ lý</a></li>
             <li><a href="social-hub.html" class="nav-link" data-link="social">👥 Cộng đồng</a></li>
             <li><a href="quests.html" class="nav-link" data-link="quests">🎯 Nhiệm vụ</a></li>
             <li><a href="history.html" class="nav-link" data-link="history">⏳ Lịch sử</a></li>
             <li><a href="leaderboard.html" class="nav-link" data-link="leaderboard">🏆 BXH</a></li>
             <li><a href="business-services.html" class="nav-link" data-link="business">🏨 Doanh nghiệp</a></li>
          </ul>
          
          <div class="site-nav__mobile-footer">
             <p>Mẹo nhỏ: Bạn có thể sử dụng AI Trợ lý để lên kế hoạch nhanh nhất.</p>
          </div>
        </nav>

        <div class="header-right">
          <button type="button" class="btn-icon notif-btn-user" onclick="WanderUI.toggleNotificationDrawer()" aria-label="Thông báo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="notif-badge" data-notif-badge style="display:none;"></span>
          </button>
          
          <button type="button" class="btn-icon" data-open-settings title="Cài đặt">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          
          <div class="user-action-area" id="header-user-area">
             <div class="user-tray" data-auth-show hidden>
                <div class="user-rank-badge" id="header-user-rank"></div>
                <div class="user-bubble" data-user-toggle>
                   <span class="user-initial" data-user-initial>?</span>
                   <img src="" alt="" class="user-avatar" data-user-avatar hidden />
                </div>
                <div class="user-dropdown" data-user-dropdown hidden>
                   <div class="user-dropdown__head">
                      <div class="user-dropdown__name" data-user-name>Tài khoản</div>
                   </div>
                   <div class="user-dropdown__body">
                      <!-- Injected via syncAuthUI -->
                   </div>
                </div>
             </div>
             <button class="btn btn--primary login-btn" data-auth-open onclick="location.href='index.html#auth'">Đăng nhập</button>
          </div>
        </div>
      </div>
    `;

  }

  function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const updateActive = () => {
      const fullPath = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
      const hash = window.location.hash.toLowerCase();

      navLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        let isCurrent = false;

        if (href.includes('#')) {
          const [hPage, hHash] = href.split('#');
          // If on index.html and link is index.html#hash or just #hash
          if ((fullPath === 'index.html' || fullPath === '') && (hPage === 'index.html' || hPage === '')) {
            isCurrent = hash === ('#' + hHash);
          }
        } else {
          isCurrent = (href === fullPath) || (fullPath === '' && href === 'index.html');
          // Special case: if we have a hash on index.html, the 'Home' link (index.html) shouldn't be active
          if (isCurrent && fullPath === 'index.html' && hash && href === 'index.html') {
            isCurrent = false;
          }
        }

        if (isCurrent) link.classList.add('active');
        else link.classList.remove('active');
      });
    };

    updateActive();
    window.addEventListener('hashchange', updateActive);

    // Mobile toggle
    const toggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');
    const overlay = document.querySelector('[data-nav-overlay]');
    const header = document.querySelector('.site-header');

    if (toggle && nav) {
      const closeMenu = () => {
        nav.classList.remove('is-open');
        if (header) header.classList.remove('is-nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      };

      toggle.onclick = (e) => {
        e.preventDefault();
        const isOpen = nav.classList.toggle('is-open');
        if (header) header.classList.toggle('is-nav-open', isOpen);
        toggle.setAttribute('aria-expanded', isOpen);
      };

      // Close on overlay click
      if (overlay) {
        overlay.onclick = () => closeMenu();
      }

      // Close on link click
      navLinks.forEach(l => l.addEventListener('click', closeMenu));
    }
  }

  function injectCommonComponents() {
    // 1. Navigation items are now handled by injectHeader()

    if (!document.querySelector('link[href*="companion.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'companion.css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[href*="voice-guide.css"]')) {
      const link2 = document.createElement('link');
      link2.rel = 'stylesheet';
      link2.href = 'voice-guide.css';
      document.head.appendChild(link2);
    }

    if (!document.querySelector('script[src*="chat-brain.js"]')) {
      const script1 = document.createElement('script');
      script1.src = 'chat-brain.js';
      document.body.appendChild(script1);
    }

    if (document.getElementById('global-chat-fab-wrap')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop hidden></div>
      <div class="modal" id="modal-activity-stats" data-modal="activity-stats" role="dialog" aria-modal="true" hidden>
        <div class="modal__inner modal__inner--wide activity-stats-modal" style="max-width: 960px;">
          <div class="modal__header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1.5rem 2rem;">
            <h2 class="modal__title" style="display: flex; align-items: center; gap: 0.75rem;">
               <span style="font-size: 1.5rem;">📊</span> Thống kê hoạt động cá nhân
            </h2>
            <button type="button" class="modal__close" data-modal-close aria-label="Đóng">×</button>
          </div>
          <div class="modal__body" style="padding: 2rem;">
            <div class="stats-summary-cards">
               <div class="stats-card">
                  <span class="stats-card__label">Chuyến đi</span>
                  <span class="stats-card__value" data-stat-trips>...</span>
                  <div class="stats-card__trend"><span style="color:#10b981">●</span> Đang lập kế hoạch</div>
               </div>
               <div class="stats-card">
                  <span class="stats-card__label">Yêu thích</span>
                  <span class="stats-card__value" data-stat-favs>...</span>
                  <div class="stats-card__trend"><span style="color:#0ea5e9">●</span> Địa điểm đã lưu</div>
               </div>
               <div class="stats-card">
                  <span class="stats-card__label">Trò chuyện</span>
                  <span class="stats-card__value" data-stat-chat>...</span>
                  <div class="stats-card__trend up"><span style="font-size:10px">▲</span> AI Assistant</div>
               </div>
               <div class="stats-card">
                  <span class="stats-card__label">Điểm (EXP)</span>
                  <span class="stats-card__value" data-stat-exp>...</span>
                  <div class="stats-card__trend" data-stat-rank style="color:var(--accent); font-weight:600;">Hạng: ...</div>
               </div>
            </div>

            <div class="activity-charts-grid">
               <div class="chart-container">
                  <h4 class="chart-title">📈 Tần suất hoạt động (7 ngày)</h4>
                  <div style="flex:1; position:relative;"><canvas id="userActivityChart"></canvas></div>
               </div>
               <div class="chart-container">
                  <h4 class="chart-title">🕸️ Ma trận kỹ năng</h4>
                  <div style="flex:1; position:relative;"><canvas id="userRadarChart"></canvas></div>
               </div>
               <div class="chart-container">
                  <h4 class="chart-title">📍 Phân bổ vùng miền</h4>
                  <div style="flex:1; position:relative;"><canvas id="userRegionChart"></canvas></div>
               </div>
               <div class="chart-container">
                  <h4 class="chart-title">🍩 Xu hướng sở thích</h4>
                  <div style="flex:1; position:relative;"><canvas id="userCategoryChart"></canvas></div>
               </div>
            </div>

            <div class="extra-stats-section">
               <h4 style="margin-bottom: 1.5rem; font-family: var(--font-display); font-size: 1.25rem;">💡 Chỉ số thông minh</h4>
               <div class="extra-stats-grid">
                  <div class="extra-stat-item">
                     <span class="icon">🌱</span>
                     <div class="info">
                        <strong>Dấu chân Carbon</strong>
                        <span data-stat-carbon>Giảm 15%</span>
                     </div>
                  </div>
                  <div class="extra-stat-item">
                     <span class="icon">💰</span>
                     <div class="info">
                        <strong>Tiết kiệm chi tiêu</strong>
                        <span data-stat-savings>~1.2 Tr VNĐ</span>
                     </div>
                  </div>
                  <div class="extra-stat-item">
                     <span class="icon">⏱️</span>
                     <div class="info">
                        <strong>Thời gian hoạt động</strong>
                        <span data-stat-time>Tính toán...</span>
                     </div>
                  </div>
                  <div class="extra-stat-item">
                     <span class="icon">🎯</span>
                     <div class="info">
                        <strong>Nhiệm vụ hoàn thành</strong>
                        <span data-stat-quests>Tính toán...</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal" id="modal-auth" data-modal="auth" hidden>
        <div class="modal__inner">
          <div class="modal__header"><h3>Tài khoản</h3><button class="modal__close" data-modal-close>×</button></div>
          <div class="modal__body"><p>Đăng nhập để tiếp tục hành trình của bạn.</p></div>
        </div>
      </div>
      <!-- Global Chatbot FAB -->
      <div class="chat-fab-wrap" id="global-chat-fab-wrap" style="display:none; z-index:9999;">
        <button type="button" class="chat-fab" id="global-chat-fab" aria-expanded="false">
          <span aria-hidden="true">💬</span>
          <span class="visually-hidden">Mở trợ lý du lịch</span>
        </button>
        <div id="global-chat-panel" class="chat-panel" hidden>
          <div class="chat-panel__head">
            <div class="chat-panel__head-left">
              <strong>Trợ lý WanderViệt</strong>
            </div>
            <div class="chat-panel__head-actions" style="display:flex; gap:8px; align-items:center; margin-left:auto; margin-right:8px;">
              <div class="chat-lang-switcher" title="Chọn ngôn ngữ" id="global-lang-switcher">
                <button type="button" class="btn-icon-sm chat-lang-btn">🌐 <span class="current-lang-code" id="global-lang-code">VI</span></button>
                <div class="chat-lang-dropdown" id="global-lang-dropdown">
                  <button type="button" data-lang="auto">Auto (Tự nhận)</button>
                  <button type="button" data-lang="vi">Tiếng Việt (VI)</button>
                  <button type="button" data-lang="en">English (EN)</button>
                  <button type="button" data-lang="jp">日本語 (JP)</button>
                  <button type="button" data-lang="kr">한국어 (KR)</button>
                  <button type="button" data-lang="fr">Français (FR)</button>
                </div>
              </div>
              <button type="button" class="btn-icon-sm" title="Chat mới" id="global-chat-new-btn">➕</button>
              <button type="button" class="btn-icon-sm" title="Lịch sử chat" id="global-chat-history-btn">🕒</button>
            </div>
            <button type="button" class="chat-panel__close" id="global-chat-close" aria-label="Đóng chat">×</button>
          </div>
          
          <div class="chat-sessions-sidebar" id="global-chat-sessions-view" hidden>
            <div class="chat-sessions-sidebar__inner">
              <div class="chat-sessions-sidebar__header">
                <span>Lịch sử trò chuyện</span>
                <button type="button" class="btn-close-sidebar" id="global-chat-history-close">×</button>
              </div>
              <div class="chat-sessions-sidebar__body" id="global-chat-sessions-list">
                <div class="chat-sessions-loading">Đang tải lịch sử...</div>
              </div>
            </div>
          </div>
          
          <p class="chat-panel__disclaimer">Trợ lý ghép gợi ý từ dữ liệu trang + sở thích bạn lưu; không phải AI tổng quát. Visa/y tế vẫn cần nguồn chính thức.</p>
          <div class="chat-log" id="global-chat-log" role="log" aria-live="polite"></div>
          <form class="chat-form" id="global-chat-form">
            <label class="visually-hidden" for="global-chat-input">Nhập câu hỏi</label>
            <input id="global-chat-input" type="text" placeholder="Hỏi về du lịch Việt Nam…" autocomplete="off" />
            <div class="companion-fab-wrapper">
              <div class="companion-fab" id="companion-toggle" title="Chế độ Hướng dẫn viên Chuyên gia">
                <span class="mic-icon">🎙️</span>
                <div class="pulse-rings"></div>
              </div>
            </div>
            <button type="submit" class="btn btn--primary btn--small">Gửi</button>
          </form>
        </div>
      </div>
      
      <div id="voice-overlay" class="voice-guide-ui">
        <div id="live-caption" class="voice-indicator">
          <div class="voice-wave">
            <div class="voice-bar"></div><div class="voice-bar"></div>
            <div class="voice-bar"></div><div class="voice-bar"></div>
            <div class="voice-bar"></div>
          </div>
          <span class="voice-text">Đang nghe...</span>
        </div>
      </div>
      <div class="modal" id="modal-settings" data-modal="settings" hidden>
        <div class="modal__inner modal__inner--wide">
          <div class="modal__header">
            <h2 id="settings-title" class="modal__title">⚙️ Cài đặt hệ thống</h2>
            <button type="button" class="modal__close" data-modal-close aria-label="Đóng">×</button>
          </div>
          <div class="modal__body settings-layout">
            <div class="settings-sidebar">
              <button class="settings-nav-btn is-active" data-settings-tab="security">🔒 Bảo mật</button>
              <button class="settings-nav-btn" data-settings-tab="appearance">🌓 Giao diện</button>
              <button class="settings-nav-btn" data-settings-tab="notifications">🔔 Thông báo</button>
              <button class="settings-nav-btn" data-settings-tab="privacy">🔐 Quyền & Riêng tư</button>
            </div>
            <div class="settings-main">
              <!-- Security Panel -->
              <div class="settings-panel is-active" data-settings-panel="security">
                <h3>Tài khoản & Bảo mật</h3>
                <form data-password-form-v2>
                  <label class="field"><span class="field-label">Mật khẩu cũ</span><input type="password" name="oldPassword" required /></label>
                  <label class="field"><span class="field-label">Mật khẩu mới</span><input type="password" name="newPassword" required minlength="6" /></label>
                  <button type="submit" class="btn btn--primary">Đổi mật khẩu</button>
                  <p data-password-status-v2 role="status" style="margin-top:0.5rem; font-size:0.9rem"></p>
                </form>
              </div>
              <!-- Appearance Panel -->
              <div class="settings-panel" data-settings-panel="appearance" hidden>
                <h3>Tùy chỉnh Giao diện</h3>
                <div class="appearance-grid">
                  <div class="theme-option" data-theme-set="light">
                    <div class="theme-preview theme-preview--light"></div>
                    <span>Sáng</span>
                  </div>
                  <div class="theme-option is-active" data-theme-set="dark">
                    <div class="theme-preview theme-preview--dark"></div>
                    <span>Tối</span>
                  </div>
                </div>
                <div style="margin-top:1.5rem">
                  <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer">
                    <input type="checkbox" id="auto-theme" style="width:20px; height:20px" />
                    <span>Tự động theo hệ điều hành</span>
                  </label>
                </div>
              </div>
              <!-- Notifications Panel -->
              <div class="settings-panel" data-settings-panel="notifications" hidden>
                <h3>Thông báo</h3>
                <div class="noti-list">
                  <label class="noti-item">
                    <div class="noti-info">
                      <strong>Email thông báo</strong>
                      <span>Nhận cập nhật về lịch trình và ưu đãi qua email.</span>
                    </div>
                    <input type="checkbox" checked />
                  </label>
                </div>
              </div>
              <!-- Privacy Panel -->
              <div class="settings-panel" data-settings-panel="privacy" hidden>
                <h3>Quyền & Riêng tư</h3>
                <div class="noti-list">
                  <label class="noti-item">
                    <div class="noti-info"><strong>Quyền Vị trí</strong><span>Tìm điểm đến gần bạn nhất.</span></div>
                    <input type="checkbox" id="perm-location" checked />
                  </label>
                  <label class="noti-item">
                    <div class="noti-info"><strong>Dữ liệu duyệt web</strong><span>Ghi nhớ phiên đăng nhập.</span></div>
                    <input type="checkbox" id="perm-storage" checked />
                  </label>
                </div>
                <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1);">
                  <button class="btn btn--outline btn--small" style="color:#f87171; border-color:rgba(248,113,113,0.3)">Xóa dữ liệu cục bộ</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal" id="modal-place" data-modal="place" role="dialog" aria-modal="true" hidden>
        <div class="modal__inner modal__inner--large" style="max-width:900px; padding:0;">
          <div class="modal__header" style="position:absolute; top:10px; right:10px; z-index:10; border:none; background:transparent;">
            <button class="modal__close" data-modal-close style="background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">×</button>
          </div>
          <div class="modal__body" style="padding:0; max-height:85vh; overflow-y:auto; border-radius:1rem;"><div data-place-detail></div></div>
        </div>
      </div>
      <div class="modal" id="modal-itinerary-detail" data-modal="itinerary-detail" hidden>
        <div class="modal__inner modal__inner--large">
          <div class="modal__header">
            <h3>Chi tiết lịch trình</h3>
            <button class="modal__close" data-modal-close>×</button>
          </div>
          <div class="modal__body" id="itinerary-detail-content">
            <!-- Content will be injected here -->
          </div>
        </div>
      </div>
    `;
    while (div.firstChild) document.body.appendChild(div.firstChild);

    // Load Voice Helper AFTER UI is in DOM to prevent "element not found" errors
    if (!document.querySelector('script[src*="voice-helper.js"]')) {
      const script2 = document.createElement('script');
      script2.src = 'voice-helper.js';
      script2.onload = () => {
        console.log("🎙️ WanderUI: voice-helper.js loaded.");
        if (window.WanderUI && window.WanderUI.setupVoiceIntegration) {
          window.WanderUI.setupVoiceIntegration();
        }
      };
      document.body.appendChild(script2);
    }

    // Add global listener for close buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]') || e.target.matches('[data-modal-backdrop]')) {
        const modal = e.target.closest('[data-modal]') || document.querySelector('[data-modal]:not([hidden])');
        if (modal) closeModal(modal);
      }
    });
  }

  async function openPlaceDetail(id, localData) {
    const wrap = document.querySelector('[data-place-detail]');
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="modal-loading-placeholder animate-in" style="padding:2.5rem;">
        <div class="skeleton" style="width:40%; height:32px; border-radius:8px; margin-bottom:1.5rem;"></div>
        <div class="skeleton" style="width:100%; height:300px; border-radius:24px; margin-bottom:1.5rem;"></div>
        <div class="skeleton" style="width:90%; height:16px; border-radius:4px; margin-bottom:0.75rem;"></div>
        <div class="skeleton" style="width:70%; height:16px; border-radius:4px;"></div>
      </div>
    `;
    openModal('place');

    try {
      let p = localData;
      if (!p) {
        const res = await fetch(`/api/places/${id}?t=${Date.now()}`);
        const json = await res.json();
        if (!json.success) throw new Error('Data not found');
        p = json.data;
      }

      const heroImage = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "");
      let galleryHtml = "";
      if (p.images && p.images.length > 1) {
        galleryHtml = '<div class="place-detail__gallery">' + p.images.map((img, i) =>
          `<div class="gallery-thumb${i === 0 ? ' is-active' : ''}" data-full="${img}"><img src="${img}" alt="Thumb"></div>`
        ).join("") + '</div>';
      }

      const actsHtml = (p.activities || []).map(a => {
        let color = "#38bdf8";
        if (a.dayPart.toLowerCase().includes("sáng")) color = "#fbbf24";
        if (a.dayPart.toLowerCase().includes("chiều")) color = "#f43f5e";
        if (a.dayPart.toLowerCase().includes("tối")) color = "#818cf8";
        return `
          <div class="act-row-v2">
            <div class="act-dot" style="background:${color}"></div>
            <div class="act-content">
              <strong style="color:${color}">${a.dayPart}: ${a.title}</strong>
              <p>${a.tip}</p>
            </div>
          </div>`;
      }).join("");

      const sectionsHtml = ['amusementPlaces', 'accommodations', 'diningPlaces', 'checkInSpots'].map(key => {
        if (!p[key] || !p[key].length) return '';
        const title = { amusementPlaces: '🎡 Hoạt động vui chơi', accommodations: '🛌 Nơi nghỉ ngơi', diningPlaces: '🥘 Ẩm thực đặc sắc', checkInSpots: '📸 Điểm check-in' }[key];
        const cards = p[key].map((item, idx) => `
          <div class="detail-item-card" data-category="${key}" data-idx="${idx}">
            <div class="detail-item-img"><img src="${item.image}" alt="${item.name}"></div>
            <div class="detail-item-info">
              <h4 class="detail-item-title">${item.name}</h4>
              <div class="detail-item-subtitle">⭐ ${item.rating || '4.8'} · ${item.ticketPrice || item.priceRange || 'Tham khảo'}</div>
            </div>
          </div>
        `).join('');
        return `<div class="place-detail__section"><h4 class="detail-section-title">${title}</h4><div class="detail-card-grid">${cards}</div></div>`;
      }).join('');

      wrap.innerHTML = `
        <div class="place-view-content animate-in">
          <div class="place-detail__hero"><img src="${heroImage}" id="hero-target"></div>
          ${galleryHtml}
          <div class="place-detail__info-wrap">
            <h3 class="place-detail__title-v2">${p.name}</h3>
            <p class="place-detail__meta-v2">🛡️ ${p.region} · ${p.budgetLabel || 'Tiết kiệm'} · ${p.paceLabel || 'Thong thả'}</p>
            <p class="place-detail__desc" style="line-height:1.7; color:var(--text-muted); font-size:1rem;">${p.text || ''}</p>
            <div class="place-detail__guide" style="margin-top:1.5rem; padding:1.25rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:20px;">
               <p style="margin-bottom:8px;"><strong>🚢 Di chuyển:</strong> ${p.transportTips || 'Bay đến sân bay gần nhất và di chuyển bằng taxi/bus.'}</p>
               ${p.sourceUrl ? `<p><strong>🔗 Tham khảo:</strong> <a href="${p.sourceUrl}" target="_blank" style="color:var(--accent); text-decoration:none;">${p.sourceName || 'Website chính thức'}</a></p>` : ''}
            </div>
          </div>
          <div class="place-detail__activities-v2">
            <h4 class="detail-section-title">📅 Lịch trình gợi ý</h4>
            ${actsHtml}
          </div>
          ${sectionsHtml}
          <div id="place-map" class="place-detail__map-v2"></div>
          <div class="place-detail__actions-v2" style="padding: 1.5rem 2.5rem 2.5rem; display:flex; gap:12px;">
            <button type="button" class="btn btn--primary" style="flex:1;" onclick="window.addStopById?addStopById('${p.id}'):null">Thêm vào lịch</button>
            <button type="button" class="btn btn--ghost btn-wish-sync" style="flex:1;" onclick="window.toggleWish?toggleWish('${p.id}'):null">
              ♥ ${p.favoritesCount || 0}
            </button>
          </div>
        </div>
        <div class="am-view-content" style="display:none;"></div>
      `;

      // Interactivity
      wrap.querySelectorAll('.gallery-thumb').forEach(thumb => {
        thumb.onclick = () => {
          wrap.querySelector('#hero-target').src = thumb.dataset.full;
          wrap.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('is-active'));
          thumb.classList.add('is-active');
        };
      });

      // Map
      if (window.L && p.lat) {
        setTimeout(() => {
          const m = L.map("place-map", { scrollWheelZoom: false }).setView([p.lat, p.lng], 14);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(m);
          L.marker([p.lat, p.lng]).addTo(m);
        }, 400);
      }
    } catch (e) {
      wrap.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">Lỗi: ${e.message}</div>`;
    }
  }

  function openItineraryDetail(id, localPlan) {
    const contentEl = document.getElementById('itinerary-detail-content');
    if (!contentEl) return;
    openModal('itinerary-detail');

    if (localPlan) {
      // Render directly from passed data (no DB fetch needed)
      renderItineraryInModal(contentEl, localPlan);
      return;
    }

    contentEl.innerHTML = '<div style="padding:40px; text-align:center;">\u0110ang t\u1ea3i l\u1ecbch tr\u00ecnh...</div>';
    const token = localStorage.getItem('wander_token');
    fetch(`/api/planner/itinerary/${id}`, { headers: { 'x-auth-token': token || '' } })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.message);
        renderItineraryInModal(contentEl, json.data);
      })
      .catch(e => {
        contentEl.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">\u0110\u1ecbch tr\u00ecnh n\u00e0y kh\u00f4ng t\u00ecm th\u1ea5y ho\u1eb7c \u0111\u00e3 b\u1ecb x\u00f3a.</div>`;
      });
  }

  function renderItineraryInModal(contentEl, itin) {
    const plan = itin.planJson || itin;
    const destination = itin.destination || plan.destination || 'Lịch trình';
    const days = itin.days || plan.days || '';
    const tripDate = itin.tripDate || plan.tripDate || null;
    const daysList = (plan && Array.isArray(plan.itinerary)) ? plan.itinerary : [];

    // Helper: format date VN
    function fmtDate(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
      return `${dow.replace('T', 'Thứ ').replace('CN', 'Chủ nhật')}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Header summary card
    const accomHtml = plan.accommodationSuggestion
      ? `<div class="meta-card"><div class="meta-icon-wrapper" style="background:rgba(2,132,199,0.1);color:#0284c7;font-size:1.2rem;">${plan.accommodationSuggestion.icon}</div><div class="meta-content"><p>${plan.accommodationSuggestion.typeLabel}</p><h4>${plan.accommodationSuggestion.nameAndCost}</h4></div></div>`
      : `<div class="meta-card"><div class="meta-icon-wrapper" style="background:rgba(2,132,199,0.1);color:#0284c7;">🏨</div><div class="meta-content"><p>Đề xuất Lưu trú</p><h4>${plan.suggestedHotel || 'Tự chọn'}</h4></div></div>`;

    let html = `
      <div class="timeline-header" style="margin-top:0.5rem;">
        <h2 style="font-size:1.8rem;color:var(--text);margin-bottom:0.5rem;line-height:1.3;">
          Lịch trình: ${destination} (${days} Ngày)
        </h2>
        ${plan.tripSummary ? `<p class="timeline-summary">${plan.tripSummary}</p>` : ''}
        <div class="timeline-meta">
          <div class="meta-card">
            <div class="meta-icon-wrapper" style="background:rgba(16,185,129,0.1);color:#10b981;">💰</div>
            <div class="meta-content">
              <p>Dự kiến Chi phí</p>
              <h4>${plan.estimatedCost || 'Đang ước tính'}</h4>
            </div>
          </div>
          ${accomHtml}
        </div>
      </div>
    `;

    if (daysList.length === 0) {
      html += '<p style="color:var(--text-muted);padding:20px 0;">Chưa có chi tiết lịch trình.</p>';
    } else {
      daysList.forEach((dayData, idx) => {
        let dateLabel = '';
        if (tripDate) {
          const baseDate = new Date(tripDate);
          if (!isNaN(baseDate.getTime())) {
            baseDate.setDate(baseDate.getDate() + idx);
            dateLabel = ' — ' + fmtDate(baseDate.toISOString().split('T')[0]);
          }
        }
        const dayNum = (dayData.day || (idx + 1)).toString().replace(/\s*\(.*\)/, '');
        html += `
          <div class="timeline-day">
            <div class="day-badge">Ngày ${dayNum}${dateLabel}</div>
            <div class="day-activities">
        `;
        (dayData.activities || []).forEach(act => {
          html += `
            <div class="activity-card">
              <div class="activity-time">${act.time || ''}</div>
              <h3 class="activity-title" style="margin-top:0.25rem;">${act.task || act.name || ''}</h3>
              <p style="color:var(--text-muted);margin-bottom:0.5rem;font-size:0.95rem;">${act.location || act.desc || ''}</p>
              <div class="activity-details" style="border-top:1px dashed var(--border);padding-top:0.5rem;">
                <span style="font-size:0.85rem;color:var(--text-muted);">Chi phí dự kiến</span>
                <span class="activity-cost">${act.cost || '0đ'}</span>
              </div>
            </div>
          `;
        });
        html += `</div></div>`;
      });
    }

    contentEl.innerHTML = html;
  }


  function showLeaderboard() { window.location.href = 'leaderboard.html'; }

  // ─── CSS Injection ──────────────────────────────────────────────────────────
  (function injectSharedStyles() {
    if (!document.getElementById('rank-filter-svg')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'rank-filter-svg';
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
      svg.innerHTML = `<defs><filter id="remove-black" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 2.5 2.5 2.5 0 -1.5" /></filter></defs>`;
      document.body.appendChild(svg);
    }
    if (document.getElementById('wander-shared-styles')) return;
    const style = document.createElement('style');
    style.id = 'wander-shared-styles';
    style.textContent = `
      .rank-sprite {
        width: 80px; height: 80px; background-size: contain; background-repeat: no-repeat; background-position: center;
        flex-shrink: 0; display: inline-block; position: relative;
        filter: url(#remove-black) drop-shadow(0 0 2px rgba(0,0,0,0.8));
      }
      .rank-text { font-weight: 700; font-size: 0.9rem; letter-spacing: 0.5px; color: var(--text); margin-left: 4px; }
      .rank-bronze-1, .rank-bronze-2, .rank-bronze-3 { background-image: url('assets/img/rank_bronze.png'); }
      .rank-silver-1, .rank-silver-2, .rank-silver-3 { background-image: url('assets/img/rank_silver.png'); }
      .rank-gold-1, .rank-gold-2, .rank-gold-3 { background-image: url('assets/img/rank_gold.png'); }
      .rank-platinum-1, .rank-platinum-2, .rank-platinum-3 { 
        background-image: url('assets/img/rank_platinum.png'); 
        filter: url(#remove-black) hue-rotate(-20deg) brightness(1.3) saturate(1.2) drop-shadow(0 0 5px rgba(0, 240, 255, 0.4));
      }
      .rank-diamond-1, .rank-diamond-2, .rank-diamond-3 { background-image: url('assets/img/rank_diamond.png'); }
      .rank-legendary {
        background-image: url('assets/img/rank_legendary_premium.png?v=6000');
        width: 80px; height: 80px; 
        transform: scale(1.3); transform-origin: center;
        filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.5));
      }
      .wander-toast {
        pointer-events: auto; min-width: 300px; padding: 1rem 1.25rem; border-radius: 14px;
        background: rgba(30,41,59,0.95); backdrop-filter: blur(20px); color: #f1f5f9;
        box-shadow: 0 12px 40px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        animation: wander-toast-in 0.4s cubic-bezier(0.18,0.89,0.32,1.28);
      }
      @keyframes wander-toast-in { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
      .wander-notif-drawer {
        position: fixed; top: 0; right: 0; width: 380px; height: 100vh;
        background: var(--bg-elevated, #1e293b); box-shadow: -10px 0 40px rgba(0,0,0,0.3);
        z-index: 10000; display: none; flex-direction: column;
        transform: translateX(100%); transition: transform 0.3s ease;
      }
      .wander-notif-drawer.is-open { transform: translateX(0); }
      .wander-notif-item { padding: 1rem; border-bottom: 1px solid var(--border); cursor: pointer; }
      .wander-notif-item.is-unread { background: rgba(59,130,246,0.1); }
      .btn-loading { position: relative; color: transparent !important; }
      .btn-loading::after {
        content: ""; position: absolute; width: 1.1rem; height: 1.1rem;
        top: 50%; left: 50%; margin: -0.55rem;
        border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      #header-user-rank { display: inline-flex; align-items: center; white-space: nowrap; gap: 4px; }
      #header-user-rank .rank-text { 
        max-width: 140px; overflow: hidden; text-overflow: ellipsis; 
        font-weight: 700; font-family: var(--font-display, inherit);
      }
      /* Custom Modal Sizes */
      .modal__inner--large { max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto; }
      .place-detail-hero {
        height: 200px; background-size: cover; background-position: center;
        display: flex; align-items: flex-end; padding: 24px; color: #fff;
        position: relative; border-radius: 20px 20px 0 0;
      }
      .place-detail-hero::after {
        content: ""; position: absolute; inset: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
      }
      .place-detail-hero-content { position: relative; z-index: 1; }
      .place-detail-hero-content h1 { font-family: 'Outfit'; font-size: 2rem; margin: 0; }

      /* ===== Planner Timeline Styles (shared) ===== */
      @keyframes itinFadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .timeline-header {
        background: var(--bg-elevated, #1e293b);
        padding: 1.75rem 2rem; border-radius: 1.25rem;
        margin-bottom: 2rem; border-left: 5px solid #10b981;
        border-top: 1px solid var(--border);
      }
      .timeline-summary { font-size: 1.05rem; color: var(--text-muted); line-height: 1.65; margin-bottom: 1rem; }
      .timeline-meta { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1.5rem; }
      .meta-card {
        flex: 1; min-width: 220px; background: var(--bg-card);
        padding: 1.25rem; border-radius: 1rem; border: 1px solid var(--border);
        display: flex; align-items: center; gap: 1.25rem;
        transition: transform 0.3s, box-shadow 0.3s;
      }
      .meta-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(31,38,135,0.1); }
      .meta-icon-wrapper {
        font-size: 2rem; width: 55px; height: 55px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 14px; flex-shrink: 0;
      }
      .meta-content p {
        font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.35rem;
        font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .meta-content h4 { font-size: 1.15rem; color: var(--text); margin: 0; line-height: 1.35; }
      .timeline-day { margin-bottom: 2.5rem; position: relative; animation: itinFadeInUp 0.6s ease-out forwards; }
      .day-badge {
        display: inline-flex; align-items: center;
        background: var(--bg-elevated, #1e293b); color: var(--text);
        padding: 0.6rem 2rem 0.6rem 1.5rem;
        border-radius: 2rem 0.5rem 2rem 0;
        font-weight: 700; font-size: 1.05rem; margin-bottom: 1.75rem;
        box-shadow: 0 8px 20px rgba(15,23,42,0.3);
        letter-spacing: 0.5px; text-transform: uppercase;
        border-left: 4px solid #10b981;
      }
      .day-activities {
        border-left: 2px dashed var(--border);
        margin-left: 1.5rem; padding-left: 2rem;
        display: flex; flex-direction: column; gap: 1.25rem;
      }
      .activity-card {
        position: relative; background: var(--bg-card);
        padding: 1.5rem; border-radius: 1rem;
        border: 1px solid var(--border);
        transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      }
      .activity-card:hover {
        transform: translateX(6px) translateY(-2px);
        box-shadow: 0 12px 24px -6px rgba(16,185,129,0.2);
        border-left: 4px solid #10b981;
      }
      .activity-card::before {
        content: ''; position: absolute; left: -2.4rem; top: 1.6rem;
        width: 14px; height: 14px; border-radius: 50%;
        background: var(--bg-elevated, #1e293b);
        border: 3px solid var(--border);
        transition: all 0.3s ease;
      }
      .activity-card:hover::before {
        border-color: #10b981; background: #ecfdf5;
        box-shadow: 0 0 12px rgba(16,185,129,0.6);
      }
      .activity-time {
        display: inline-flex; align-items: center;
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff; font-weight: 700; font-size: 0.85rem;
        padding: 0.3rem 0.8rem; border-radius: 6px;
        margin-bottom: 0.75rem; letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(16,185,129,0.3);
      }
      .activity-title {
        font-size: 1.05rem; font-weight: 700;
        color: var(--text); margin: 0.25rem 0 0.3rem; line-height: 1.35;
      }
      .activity-details {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 0.85rem; color: var(--text-muted);
        border-top: 1px dashed var(--border);
        padding-top: 0.625rem; margin-top: 0.5rem;
      }
      .activity-cost { font-weight: 700; color: #059669; font-size: 0.9rem; }

      /* Proposal Card Styles - Generation 3.0 Super Premium */
      .chat-proposal-card-premium {
        margin: 12px 0; padding: 18px; border-radius: 22px;
        background: linear-gradient(165deg, #1e293b, #0f172a);
        border: 1px solid rgba(16, 185, 129, 0.25);
        box-shadow: 0 15px 35px rgba(0,0,0,0.4);
        animation: wander-toast-in 0.4s cubic-bezier(0.18,0.89,0.32,1.28);
        flex-shrink: 0;
        transition: transform 0.3s, border-color 0.3s;
      }
      .chat-proposal-card-premium:hover {
        transform: translateY(-4px);
        border-color: var(--accent);
      }
      .proposal-header {
        font-size: 0.65rem; font-weight: 900; text-transform: uppercase;
        color: var(--accent); letter-spacing: 1.2px; margin-bottom: 10px;
        display: flex; align-items: center; gap: 6px;
      }
      .btn-proposal-action {
        width: 100%; padding: 11px; border-radius: 12px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff; font-weight: 800; border: none; cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 0.85rem; letter-spacing: 0.3px;
        box-shadow: 0 4px 15px rgba(16,185,129,0.25);
      }
      .btn-proposal-action:hover {
        filter: brightness(1.1);
        transform: scale(1.02);
        box-shadow: 0 6px 20px rgba(16,185,129,0.4);
      }
      .btn-proposal-action:active { transform: scale(0.97); }

      /* Inline Itinerary Card in Chatbot - Premium Design */
      .chat-itinerary-card {
        margin: 10px 0; border-radius: 18px; overflow: hidden;
        border: 1px solid rgba(59,130,246,0.2);
        background: #0b1629;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        animation: wander-toast-in 0.4s ease-out;
        max-height: 600px; overflow-y: auto;
        flex-shrink: 0;
      }
      .chat-itinerary-card::-webkit-scrollbar { width: 5px; }
      .chat-itinerary-card::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.25); border-radius: 4px; }
      .chat-itin-hero {
        padding: 20px 20px 16px;
        background: radial-gradient(ellipse at top right, rgba(59,130,246,0.15), transparent),
                    linear-gradient(160deg, #0d1b35, #0b1629);
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .chat-itin-dest-pill {
        display: inline-block; padding: 4px 12px;
        background: rgba(59,130,246,0.18); color: #60a5fa;
        border-radius: 30px; font-size: 0.68rem; font-weight: 900;
        letter-spacing: 1.5px; margin-bottom: 10px;
      }
      .chat-itin-hero-title { font-size: 1.25rem; font-weight: 900; color: #fff; margin: 0 0 6px; line-height: 1.2; }
      .chat-itin-hero-sub { font-size: 0.82rem; color: #94a3b8; margin: 0 0 14px; line-height: 1.5; }
      .chat-itin-stats {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 10px; padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.07);
      }
      .chat-itin-stat { display: flex; flex-direction: column; gap: 3px; }
      .chat-itin-stat-label { font-size: 0.6rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
      .chat-itin-stat-val { font-size: 0.92rem; font-weight: 800; color: #38bdf8; }
      .chat-itin-timeline { padding: 16px 16px 8px; display: flex; flex-direction: column; gap: 14px; }
      .chat-itin-day-block { display: flex; gap: 12px; animation: slideInUp 0.5s ease-out both; }
      .chat-itin-day-sidebar { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding-top: 2px; }
      .chat-itin-day-num {
        width: 34px; height: 34px; border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: #fff; font-weight: 900; font-size: 0.9rem;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(59,130,246,0.4);
      }
      .chat-itin-day-content { flex: 1; min-width: 0; }
      .chat-itin-day-title { font-size: 0.88rem; font-weight: 800; color: #fff; margin-bottom: 6px; }
      .chat-itin-day-sub { font-size: 0.75rem; color: #94a3b8; margin-bottom: 8px; }
      .chat-itin-acts { display: flex; flex-direction: column; gap: 6px; }
      .chat-itin-act-card {
        display: flex; gap: 10px; padding: 10px 12px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px; transition: background 0.2s;
      }
      .chat-itin-act-card:hover { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.2); }
      .chat-itin-act-time { font-size: 0.7rem; font-weight: 800; color: #38bdf8; min-width: 48px; line-height: 1.4; padding-top: 1px; white-space: nowrap; }
      .chat-itin-act-info { flex: 1; }
      .chat-itin-act-name { font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 3px; }
      .chat-itin-act-loc { font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px; }
      .chat-itin-act-tip { font-size: 0.72rem; color: #fbbf24; margin-top: 3px; }
      .chat-itin-act-cost { display: inline-block; margin-top: 5px; padding: 2px 8px; background: rgba(16,185,129,0.12); color: #10b981; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
      .chat-itin-actions {
        display: flex; gap: 8px; padding: 10px 16px 14px;
        border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.15);
      }
      .btn-save-itin, .btn-export-itin {
        flex: 1; padding: 10px 12px; border-radius: 10px;
        font-size: 0.83rem; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s;
      }
      .btn-save-itin { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
      .btn-save-itin:hover { filter: brightness(1.1); transform: translateY(-1px); }
      .btn-export-itin { background: rgba(255,255,255,0.07); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
      .btn-export-itin:hover { background: rgba(255,255,255,0.12); color: #fff; }

      /* Quick Planner Mini-Form Skip Button */
      .cqp-btn-skip {
        width: 100%; padding: 9px 12px; border-radius: 10px;
        background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.15);
        color: #64748b; font-size: 0.82rem; font-weight: 600;
        cursor: pointer; margin-top: 6px; transition: all 0.2s;
      }
      .cqp-btn-skip:hover { color: #94a3b8; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.07); }

      /* Quick Planner Mini-Form in Chatbot */
      .chat-quick-planner-form {
        margin: 10px 0; border-radius: 18px; overflow: hidden;
        border: 1px solid rgba(59,130,246,0.3);
        background: linear-gradient(160deg, #0f172a, #1e293b);
        box-shadow: 0 16px 40px rgba(0,0,0,0.4);
        animation: wander-toast-in 0.35s cubic-bezier(0.18,0.89,0.32,1.28);
        transition: opacity 0.3s, transform 0.3s;
        flex-shrink: 0;
      }
      .cqp-header {
        display: flex; align-items: center; gap: 14px;
        padding: 16px 18px 12px; background: rgba(59,130,246,0.08);
        border-bottom: 1px solid rgba(59,130,246,0.15);
      }
      .cqp-icon { font-size: 1.8rem; width: 44px; height: 44px; background: rgba(59,130,246,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .cqp-title { font-size: 0.95rem; font-weight: 800; color: #fff; margin-bottom: 2px; }
      .cqp-sub { font-size: 0.75rem; color: #94a3b8; }
      .cqp-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }
      .cqp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .cqp-field { display: flex; flex-direction: column; gap: 5px; }
      .cqp-field label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px; }
      .cqp-optional { font-weight: 400; text-transform: none; opacity: 0.7; }
      .cqp-field input, .cqp-field select, .cqp-field textarea {
        width: 100%; padding: 9px 12px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; color: #fff; font-size: 0.88rem; font-family: inherit;
        transition: border-color 0.2s, background 0.2s;
        box-sizing: border-box;
      }
      .cqp-field input::placeholder, .cqp-field textarea::placeholder { color: #475569; }
      .cqp-field input:focus, .cqp-field select:focus, .cqp-field textarea:focus {
        outline: none; border-color: #3b82f6;
        background: rgba(59,130,246,0.08);
        box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
      }
      .cqp-field select option { background: #1e293b; }
      .cqp-field textarea { resize: none; }
      .cqp-actions {
        padding: 12px 18px 16px;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .cqp-btn-submit {
        width: 100%; padding: 12px; border: none; border-radius: 12px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: #fff; font-size: 0.9rem; font-weight: 800;
        cursor: pointer; letter-spacing: 0.3px;
        transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 4px 16px rgba(59,130,246,0.35);
      }
      .cqp-btn-submit:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(59,130,246,0.5);
        filter: brightness(1.1);
      }
      .cqp-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
      .chat-suggestion-container {
        display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;
        padding: 0 4px;
      }
      .chat-suggestion-chip {
        padding: 8px 16px; border-radius: 20px;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
      }
      .chat-suggestion-chip:hover {
        background: var(--accent); color: #000;
        border-color: var(--accent); transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(16,185,129,0.2);
      }
      .chat-suggestion-chip:active { transform: scale(0.96); }

      .chat-discovery-card {
        min-width: 180px; max-width: 180px; border-radius: 16px;
        background: #1e293b; border: 1px solid rgba(255,255,255,0.05);
        overflow: hidden; flex-shrink: 0; transition: transform 0.2s;
        cursor: pointer;
      }
      .chat-discovery-card:hover { transform: translateY(-3px); border-color: var(--accent); }
      .chat-discovery-img { height: 100px; background-size: cover; background-position: center; }
      .chat-discovery-info { padding: 10px; }
      .chat-discovery-name { font-size: 0.85rem; font-weight: 800; color: #fff; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chat-discovery-loc { font-size: 0.7rem; color: #94a3b8; }

      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
  })();

  // --- Chatbot Integration (Global, for non-homepage pages) ---
  function initGlobalChatbot() {
    const fabWrap = document.getElementById('global-chat-fab-wrap');
    if (!fabWrap) return;
    fabWrap.style.display = 'block';

    const fab = document.getElementById('global-chat-fab');
    const panel = document.getElementById('global-chat-panel');
    const closeBtn = document.getElementById('global-chat-close');
    const form = document.getElementById('global-chat-form');
    const input = document.getElementById('global-chat-input');
    const log = document.getElementById('global-chat-log');

    function togglePanel() {
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      fab.setAttribute('aria-expanded', !isOpen);

      // --- Stop AI voice when panel is closed ---
      if (isOpen && window.voiceGuide) {
          window.voiceGuide.cancelAll();
      }
    }

    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', (e) => {
        togglePanel();
        if (window.voiceGuide) window.voiceGuide.cancelAll();
    });

    // Also support external toggle buttons (like in header or hero)
    document.querySelectorAll('[data-chat-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
      });
    });

    // Đảm bảo mỗi lần reset trang là một phiên chat mới hoàn toàn (như ChatGPT)
    // Các hội thoại cũ sẽ nằm trong phần Lịch sử (History)
    localStorage.removeItem('wander_current_session');
    localStorage.removeItem('wander_shared_chat');
    let currentSessionId = null;

    // --- VOICE INTEGRATION ---
    function setupVoiceIntegration() {
        if (window.voiceGuide) {
            console.log("🎙️ WanderUI: Connecting VoiceGuide...");
            window.voiceGuide.onResultCallback = (text) => {
                console.log("🎙️ Voice Result:", text);
                const inputEl = document.getElementById('global-chat-input');
                const formEl = document.getElementById('global-chat-form');
                if (inputEl && formEl) {
                    inputEl.value = text;
                    formEl.dispatchEvent(new Event('submit'));
                }
            };

            const micBtn = document.getElementById('companion-toggle');
            if (micBtn) {
                // Single Click: Toggle or Interrupt
                micBtn.onclick = (e) => {
                    e.preventDefault();
                    if (window.voiceGuide.synth && window.voiceGuide.synth.speaking) {
                        // AI is speaking: Stop it and start listening
                        window.voiceGuide.forceInterrupt();
                    } else if (window.voiceGuide.isListening) {
                        window.voiceGuide.stop();
                    } else {
                        window.voiceGuide.start();
                    }
                };
                // Double Click: Stop Everything
                micBtn.ondblclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.voiceGuide) {
                        window.voiceGuide.cancelAll();
                    }
                };
            }
        }
    }
    // Expose for onload callback
    window.WanderUI.setupVoiceIntegration = setupVoiceIntegration;
    // Try immediate if already loaded
    setupVoiceIntegration();

    function escapeHtml(unsafe) {
      return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function renderSuggestions(options = []) {
      const container = document.createElement('div');
      container.className = 'chat-suggestion-container';
      options.forEach(opt => {
        const chip = document.createElement('div');
        chip.className = 'chat-suggestion-chip';
        chip.textContent = opt.text;
        chip.onclick = () => {
          const input = document.getElementById('global-chat-input');
          const form = document.getElementById('global-chat-form');
          if (input && form) {
            input.value = opt.query || opt.text;
            form.dispatchEvent(new Event('submit'));
          }
        };
        container.appendChild(chip);
      });
      log.appendChild(container);
      log.scrollTop = log.scrollHeight;
    }

    const DEFAULT_SUGGESTIONS = [
      { text: '🗺️ Lập lịch trình', query: 'Lập lịch trình du lịch cho mình' },
      { text: '🏨 Tìm chỗ ở', query: 'Tìm khách sạn hoặc homestay đẹp' },
      { text: '🍽️ Món ngon', query: 'Gợi ý các món ăn đặc sản địa phương' },
      { text: '📸 Điểm check-in', query: 'Những địa điểm chụp ảnh đẹp nhất' }
    ];

    function appendMsg(text, role, isHtml, skipCache = false) {
      if (!text) return;

      let displayInfo = text;
      let proposalsData = null;

      // Phát hiện dữ liệu ẩn (JSON proposals) để render lại thẻ khi load lịch sử
      if (text.includes('[ITIN_PROPOSALS:')) {
          const start = text.indexOf('[ITIN_PROPOSALS:');
          const end = text.lastIndexOf(']');
          if (start !== -1 && end !== -1) {
              const jsonStr = text.substring(start + 16, end);
              try { proposalsData = JSON.parse(jsonStr); } catch(e) {}
              displayInfo = text.substring(0, start).trim();
          }
      }

      const msg = document.createElement('div');
      msg.className = 'chat-bubble chat-bubble--' + (role === 'user' ? 'user' : 'bot');
      if (isHtml) msg.innerHTML = displayInfo;
      else msg.textContent = displayInfo;
      log.appendChild(msg);
      
      // Debounce scrolling to bottom to avoid layout thrashing
      if (!window._chatScrollTimeout) {
        window._chatScrollTimeout = setTimeout(() => {
          log.scrollTop = log.scrollHeight;
          window._chatScrollTimeout = null;
        }, 50);
      }

      // Nếu có dữ liệu proposals, render các thẻ tương ứng
      if (proposalsData && Array.isArray(proposalsData)) {
          renderProposalOptions(proposalsData);
      }

      // Cache to localStorage for instant load on next page
      if (!skipCache) {
        try {
          if (!text.includes("Đang tải") && !text.includes("đang suy nghĩ")) {
            let arr = JSON.parse(localStorage.getItem('wander_shared_chat') || '[]');
            arr.push({ role, text });
            if (arr.length > 50) arr = arr.slice(arr.length - 50);
            localStorage.setItem('wander_shared_chat', JSON.stringify(arr));
          }
        } catch (e) { console.warn("Cache error", e); }
      }
    }

    function loadSharedChat() {
      log.innerHTML = '';
      try {
        const arr = JSON.parse(localStorage.getItem('wander_shared_chat') || '[]');
        if (arr.length > 0) {
          arr.forEach(m => {
            appendMsg(m.text, m.role, false, true); // skipCache = true
          });
        } else if (!currentSessionId) {
          appendMsg('Xin chào! Tôi là Trợ lý WanderViệt 🌟 Hỏi tôi bất cứ điều gì về du lịch Việt Nam nhé!', 'bot');
          renderSuggestions(DEFAULT_SUGGESTIONS);
        }
      } catch (e) {
        if (!currentSessionId) appendMsg('Xin chào! Tôi là Trợ lý WanderViệt 🌟 Hỏi tôi bất cứ điều gì về du lịch Việt Nam nhé!', 'bot');
      }
    }

    function loadChatHistory(sid) {
      const token = localStorage.getItem('wander_token');
      // No longer clear log.innerHTML here to avoid flash if we already have cache
      currentSessionId = sid;
      localStorage.setItem('wander_current_session', sid);

      const historyView = document.getElementById('global-chat-sessions-view');
      if (historyView) {
        historyView.classList.remove('is-active');
        setTimeout(() => historyView.hidden = true, 300);
      }

      fetch("/api/chat/history/" + sid, {
        headers: { 'x-auth-token': token || '' }
      })
        .then(r => r.json())
        .then(json => {
          if (json.success && json.messages && json.messages.length > 0) {
            log.innerHTML = ''; // Only clear if we actually have server data to replace
            json.messages.forEach(m => {
              appendMsg(m.text, m.role === 'user' ? 'user' : 'bot', false, true); // skipCache = true
            });
            // Update cache with server truth
            localStorage.setItem('wander_shared_chat', JSON.stringify(json.messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'bot',
              text: m.text
            }))));
          }
        })
        .catch(() => {
          log.innerHTML = '';
          appendMsg('Lỗi kết nối khi tải lịch sử.', 'bot');
        });
    }

    function loadChatSessions() {
      const token = localStorage.getItem('wander_token');
      const historyList = document.getElementById('global-chat-sessions-list');
      if (!historyList) return;

      if (!token) {
        historyList.innerHTML = '<div class="chat-sessions-loading">Vui lòng đăng nhập để xem lịch sử.</div>';
        return;
      }
      historyList.innerHTML = '<div class="chat-sessions-loading">Đang tải...</div>';
      const deviceId = localStorage.getItem('wander_device_id');
      fetch(`/api/chat/sessions?t=${Date.now()}&deviceId=${deviceId || ''}`, {
        headers: { 'x-auth-token': token }
      })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.sessions && json.sessions.length > 0) {
          historyList.innerHTML = '';
          json.sessions.forEach(s => {
            const item = document.createElement('div');
            item.className = 'chat-session-item';
            const dateStr = new Date(s.updatedAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            item.innerHTML = '<div class="chat-session-item__info">' +
                               '<div class="chat-session-item__title">' + escapeHtml(s.title || 'Hội thoại du lịch') + '</div>' +
                               '<div class="chat-session-item__date">' + dateStr + '</div>' +
                             '</div>' +
                             '<button type="button" class="btn-delete-session" title="Xóa">🗑️</button>';
            
            item.onclick = () => loadChatHistory(s.sessionId);
            
            const delBtn = item.querySelector('.btn-delete-session');
            delBtn.onclick = (e) => {
              e.stopPropagation();
              if (confirm('Xóa vĩnh viễn đoạn hội thoại này?')) {
                const deviceId = localStorage.getItem('wander_device_id');
                fetch(`/api/chat/session/${s.sessionId}?deviceId=${deviceId || ''}`, {
                  method: 'DELETE',
                  headers: { 'x-auth-token': token }
                })
                .then(r => r.json())
                .then(res => {
                  if (res.success) {
                    item.remove();
                    if (currentSessionId === s.sessionId) {
                      currentSessionId = null;
                      localStorage.removeItem('wander_current_session');
                      log.innerHTML = '';
                      appendMsg('Hội thoại đã bị xóa.', 'bot');
                    }
                  }
                });
              }
            };
            historyList.appendChild(item);
          });
        } else {
          historyList.innerHTML = '<div class="chat-sessions-loading">Chưa có hội thoại nào.</div>';
        }
      })
      .catch(() => {
        historyList.innerHTML = '<div class="chat-sessions-loading">Lỗi tải lịch sử.</div>';
      });
    }

    // New Chat Button
    const newBtn = document.getElementById('global-chat-new-btn');
    if (newBtn) {
      newBtn.onclick = () => {
        currentSessionId = null;
        localStorage.removeItem('wander_current_session');
        localStorage.removeItem('wander_shared_chat');
        log.innerHTML = '';
        appendMsg('Chào bạn! Tôi đã sẵn sàng cho cuộc trò chuyện mới. Mình có thể giúp gì cho chuyến đi của bạn?', 'bot');
        renderSuggestions(DEFAULT_SUGGESTIONS);
      };
    }

    // History Button
    const historyBtn = document.getElementById('global-chat-history-btn');
    const historyView = document.getElementById('global-chat-sessions-view');
    const historyClose = document.getElementById('global-chat-history-close');

    if (historyBtn && historyView) {
      historyBtn.onclick = () => {
        historyView.hidden = false;
        setTimeout(() => historyView.classList.add('is-active'), 10);
        loadChatSessions();
      };
    }
    if (historyClose && historyView) {
      historyClose.onclick = () => {
        historyView.classList.remove('is-active');
        setTimeout(() => historyView.hidden = true, 300);
      };
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      appendMsg(msg, 'user');
      input.value = '';

      const tempBubble = document.createElement('div');
      tempBubble.className = 'chat-bubble chat-bubble--bot';
      tempBubble.textContent = 'AI đang suy nghĩ...';
      log.appendChild(tempBubble);
      log.scrollTop = log.scrollHeight;

      try {
        let resData;
        if (typeof window.wanderChatReply === 'function') {
           resData = await window.wanderChatReply(msg, { 
             lang: localStorage.getItem('wander_chat_lang') || 'auto',
             sessionId: currentSessionId
           });
        } else {
           const token = localStorage.getItem('wander_token');
           const res = await fetch('/api/chat', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
             body: JSON.stringify({ message: msg, lang: localStorage.getItem('wander_chat_lang') || 'auto', sessionId: currentSessionId })
           });
           resData = await res.json();
        }

        log.removeChild(tempBubble);

        if (resData && resData.success) {
            const aiReply = resData.answer || resData.reply;
            appendMsg(aiReply, 'bot');

            // AI TALK BACK
            if (window.voiceGuide && aiReply) {
                // Lọc bỏ bớt ký tự đặc biệt hoặc mã nhúng nếu có để AI nói tự nhiên
                const cleanText = aiReply.replace(/\[ITIN_PROPOSALS:.*?\]/g, '').replace(/https?:\/\/\S+/g, '').trim();
                window.voiceGuide.speak(cleanText);
            }
            if (resData.sessionId) {
              currentSessionId = resData.sessionId;
              localStorage.setItem('wander_current_session', currentSessionId);
            }
            if (resData.action === 'show_quick_form') {
                renderQuickPlannerForm(resData.prefill || {});
            } else if (resData.itineraryCard) {
                renderItineraryCard(resData.itineraryCard);
            } else if (resData.proposal) {
                renderProposalCard(resData.proposal);
            }

            if (resData.discoveryPlaces && resData.discoveryPlaces.length > 0) {
                renderDiscoveryCarousel(resData.discoveryPlaces);
            }
        } else {
            console.warn("Chatbot: API returned failure or invalid data", resData);
            const errMsg = (resData && typeof resData === 'string') ? resData : (resData?.answer || 'Trợ lý đang bận, thử lại sau nhé.');
            appendMsg(errMsg, 'bot');
        }
      } catch (err) {
        console.error("Chatbot Submit Error:", err);
        if (log && log.contains(tempBubble)) log.removeChild(tempBubble);
        appendMsg('Lỗi kết nối AI. Vui lòng kiểm tra internet hoặc tải lại trang.', 'bot');
      }
    });

    function renderQuickPlannerForm(prefill) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-quick-planner-form';
        wrapper.innerHTML = `
            <div class="cqp-header">
                <span class="cqp-icon">📝</span>
                <div>
                    <div class="cqp-title">Lập kế hoạch chi tiết</div>
                    <div class="cqp-sub">Cung cấp các thông tin cơ bản để bắt đầu</div>
                </div>
            </div>
            <div class="cqp-body">
                <div class="cqp-field">
                    <label>📍 Điểm đến mong muốn</label>
                    <input id="cqpDest" type="text" placeholder="VD: Đà Lạt, Phú Quốc..." value="${prefill.destination || ''}" />
                </div>
                <div class="cqp-row">
                    <div class="cqp-field">
                        <label>📅 Số ngày</label>
                        <input id="cqpDays" type="number" min="1" max="30" placeholder="3" value="${prefill.days || 3}" />
                    </div>
                    <div class="cqp-field">
                        <label>📅 Ngày đi</label>
                        <input id="cqpDate" type="date" />
                    </div>
                </div>
                <div class="cqp-field">
                    <label>💰 Ngân sách dự kiến</label>
                    <select id="cqpBudget">
                        <option value="2">1M - 3M VNĐ (Tiết kiệm)</option>
                        <option value="5" selected>3M - 7M VNĐ (Tiêu chuẩn)</option>
                        <option value="10">7M - 15M VNĐ (Thoải mái)</option>
                        <option value="20">15M+ VNĐ (Cao cấp)</option>
                    </select>
                </div>
                <div class="cqp-field">
                    <label>👥 Thành viên</label>
                    <select id="cqpCompanion">
                        <option value="Solo">Solo (Một mình)</option>
                        <option value="Cặp đôi">Đi cặp đôi</option>
                        <option value="Gia đình">Gia đình</option>
                        <option value="Nhóm bạn" selected>Nhóm bạn</option>
                    </select>
                </div>
                <div class="cqp-field">
                    <label>💡 Yêu cầu thêm <span class="cqp-optional">(tùy chọn)</span></label>
                    <textarea id="cqpExtra" placeholder="VD: Tôi muốn leo núi và ăn tối lãng mạn..." rows="2"></textarea>
                </div>
            </div>
            <div class="cqp-actions">
                <button class="cqp-btn-submit" type="button">Tiếp tục — AI lên lịch ngay →</button>
                <button class="cqp-btn-skip" type="button">⚡ Bỏ qua — AI tự tạo</button>
            </div>
        `;

        wrapper.querySelector('.cqp-btn-submit').onclick = async () => {
            const dest = wrapper.querySelector('#cqpDest').value.trim();
            const days = parseInt(wrapper.querySelector('#cqpDays').value) || 3;
            const budget = parseInt(wrapper.querySelector('#cqpBudget').value) || 5;
            const companion = wrapper.querySelector('#cqpCompanion').value;
            const extra = wrapper.querySelector('#cqpExtra').value.trim();

            if (!dest) {
                wrapper.querySelector('#cqpDest').style.borderColor = '#f43f5e';
                wrapper.querySelector('#cqpDest').focus();
                return;
            }

            const submitBtn = wrapper.querySelector('.cqp-btn-submit');
            submitBtn.textContent = '⏳ AI đang lên lịch trình...';
            submitBtn.disabled = true;

            const syntheticMsg = `Lập lịch trình ${days} ngày đi ${dest}, ngân sách ${budget} triệu VNĐ, ${companion}. ${extra}`;

            try {
                const token = localStorage.getItem('wander_token');
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
                    body: JSON.stringify({
                        message: syntheticMsg,
                        lang: localStorage.getItem('wander_chat_lang') || 'auto',
                        sessionId: currentSessionId
                    })
                });
                const d = await res.json();

                // Ẩn form và hiện kết quả
                wrapper.style.opacity = '0.5';
                wrapper.style.pointerEvents = 'none';

                appendMsg(d.answer || '', 'bot');
                if (d.sessionId) {
                    currentSessionId = d.sessionId;
                    localStorage.setItem('wander_current_session', currentSessionId);
                }
                if (d.itineraryCard) {
                    renderItineraryCard(d.itineraryCard);
                    wrapper.remove(); // Xóa form sau khi có lịch trình
                } else {
                    submitBtn.textContent = 'Tiếp tục — AI lên lịch ngay →';
                    submitBtn.disabled = false;
                    wrapper.style.opacity = '1';
                    wrapper.style.pointerEvents = 'auto';
                }
            } catch(e) {
                submitBtn.textContent = 'Tiếp tục — AI lên lịch ngay →';
                submitBtn.disabled = false;
            }
        };

        // Nút Bỏ qua
        wrapper.querySelector('.cqp-btn-skip').onclick = async () => {
            const dest = wrapper.querySelector('#cqpDest').value.trim() || (prefill.destination || 'Việt Nam');
            const skipBtn = wrapper.querySelector('.cqp-btn-skip');
            skipBtn.textContent = '⏳ AI đang tự tạo...';
            skipBtn.disabled = true;
            wrapper.querySelector('.cqp-btn-submit').disabled = true;
            const token = localStorage.getItem('wander_token');
            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
                    body: JSON.stringify({ message: `Lập lịch trình tùy ý 3 ngày đi ${dest}, ngân sách 5 triệu VNĐ`, lang: localStorage.getItem('wander_chat_lang') || 'auto', sessionId: currentSessionId })
                });
                const d = await res.json();
                appendMsg(d.answer || '', 'bot');
                if (d.sessionId) { currentSessionId = d.sessionId; localStorage.setItem('wander_current_session', currentSessionId); }
                if (d.itineraryCard) { renderItineraryCard(d.itineraryCard); wrapper.remove(); }
                else { skipBtn.textContent = '⚡ Bỏ qua — AI tự tạo'; skipBtn.disabled = false; wrapper.querySelector('.cqp-btn-submit').disabled = false; }
            } catch(e) { skipBtn.textContent = '⚡ Bỏ qua — AI tự tạo'; skipBtn.disabled = false; }
        };

        log.appendChild(wrapper);
        log.scrollTop = log.scrollHeight;

        // Focus vào dest nếu chưa có
        if (!prefill.destination) {
            setTimeout(() => wrapper.querySelector('#cqpDest')?.focus(), 200);
        }
    }

    function renderProposalCard(proposal) {
        const card = document.createElement('div');
        card.className = 'chat-proposal-card-premium';
        card.innerHTML = `
            <div class="proposal-header">✨ Đề xuất hành trình</div>
            <div class="proposal-body">
                <h4 style="margin:0 0 4px; color:#fff;">${proposal.title || 'Hành trình ' + (proposal.destination || '')}</h4>
                <p style="margin:0; font-size:0.85rem; opacity:0.8;">${proposal.days} ngày | ${proposal.style || 'Cơ bản'}</p>
                <div class="proposal-budget" style="margin-top:8px; color:var(--accent); font-weight:700;">💰 ${proposal.budget}</div>
                <p style="margin:6px 0 0; font-size:0.75rem; color:#94a3b8; font-style:italic;">"${proposal.description || ''}"</p>
            </div>
            <button type="button" class="btn-proposal-action" style="margin-top:12px; width:100%; padding:10px; border-radius:10px; background:var(--accent); color:#000; font-weight:800; border:none; cursor:pointer; transition:all 0.2s; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">Xem chi tiết & Chỉnh sửa 🚀</button>
        `;
        const btn = card.querySelector('button');
        btn.onclick = () => {
            btn.style.transform = 'scale(0.95)';
            if (window.location.pathname.includes('planner.html') && window.WanderPlanner && window.WanderPlanner.loadDraft) {
                window.WanderPlanner.loadDraft(proposal);
                togglePanel(); // Đóng chatbot
            } else {
                localStorage.setItem('wander_itinerary_proposal_draft', JSON.stringify(proposal));
                window.location.href = 'planner.html';
            }
        };
        log.appendChild(card);
        log.scrollTop = log.scrollHeight;
    }

    function renderDiscoveryCarousel(places = []) {
        const container = document.createElement('div');
        container.style.cssText = `display:flex; gap:12px; margin:12px 0; overflow-x:auto; padding-bottom:10px; scroll-snap-type:x mandatory;`;
        container.classList.add('no-scrollbar');

        places.forEach(p => {
            const card = document.createElement('div');
            card.className = 'chat-discovery-card';
            card.innerHTML = `
                <div class="chat-discovery-img" style="background-image:url('${p.image || 'assets/img/hero_nature.jpg'}')"></div>
                <div class="chat-discovery-info">
                    <div class="chat-discovery-name">${p.name}</div>
                    <div class="chat-discovery-loc">📍 ${p.region || 'Việt Nam'}</div>
                </div>
            `;
            card.onclick = () => {
                if (window.WanderUI && window.WanderUI.showPlaceDetail) {
                    window.WanderUI.showPlaceDetail(p.id || p.name);
                } else {
                    appendMsg(`Cho mình biết thêm về ${p.name} nhé!`, 'user');
                    document.getElementById('global-chat-input').value = `Thông tin về ${p.name}`;
                    document.getElementById('global-chat-form').dispatchEvent(new Event('submit'));
                }
            };
            container.appendChild(card);
        });
        log.appendChild(container);
        log.scrollTop = log.scrollHeight;
    }

    function renderProposalOptions(proposals) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex; 
            flex-direction: row; 
            gap: 10px; 
            margin: 10px 0; 
            overflow-x: auto; 
            padding: 5px 10px 15px;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
        `;
        container.classList.add('no-scrollbar');
        
        proposals.forEach(p => {
            const card = document.createElement('div');
            card.className = 'chat-proposal-card-premium';
            card.style.cssText = `
                min-width: 230px; 
                max-width: 230px; 
                margin: 0; 
                flex-shrink: 0; 
                scroll-snap-align: start;
                display: flex;
                flex-direction: column;
                background: linear-gradient(160deg, #1e293b, #0f172a);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-radius: 14px;
                padding: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.4);
                transition: transform 0.2s;
            `;
            card.innerHTML = `
                <div class="proposal-header" style="font-size:0.6rem; color:var(--accent); font-weight:900; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">✨ Đề xuất tối ưu</div>
                <div class="proposal-body" style="flex: 1; min-height: 100px;">
                    <h4 style="margin:0 0 4px; color:#fff; font-size: 0.9rem; font-weight:800; line-height:1.2;">${p.title}</h4>
                    <div style="display:flex; gap:6px; margin-bottom:8px;">
                        <span style="font-size:0.6rem; background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:10px; color:#cbd5e1;">📅 ${p.days} Ngày</span>
                        <span style="font-size:0.6rem; background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:10px; color:#cbd5e1;">🎒 ${p.style}</span>
                    </div>
                    <p style="margin:0; font-size: 0.72rem; color:#94a3b8; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.8em;">"${p.description}"</p>
                    <div style="margin-top:8px; font-size:0.85rem; color:var(--accent); font-weight:800;">💰 ${p.budget}</div>
                </div>
                <button type="button" class="btn-proposal-action" style="margin-top:10px; width:100%; padding:9px; border-radius:10px; background:var(--accent); color:#000; font-weight:800; border:none; cursor:pointer; transition:all 0.2s; font-size:0.75rem;">Chọn hành trình này →</button>
            `;
            const btn = card.querySelector('button');
            btn.onclick = () => {
                if (window.location.pathname.includes('planner.html') && window.WanderPlanner && window.WanderPlanner.loadDraft) {
                    window.WanderPlanner.loadDraft(p);
                    togglePanel(); // Đóng chatbot
                } else {
                    localStorage.setItem('wander_itinerary_proposal_draft', JSON.stringify(p));
                    window.location.href = 'planner.html';
                }
            };
            container.appendChild(card);
        });

        log.appendChild(container);
        log.scrollTop = log.scrollHeight;
    }

    function renderItineraryCard(itin) {
        const card = document.createElement('div');
        card.className = 'chat-itinerary-card';

        // Stats grid
        const statsHtml = `
            <div class="chat-itin-stats">
                <div class="chat-itin-stat"><div class="chat-itin-stat-label">THỜI GIAN</div><div class="chat-itin-stat-val">${itin.days || ''} Ngày</div></div>
                <div class="chat-itin-stat"><div class="chat-itin-stat-label">DỰ KIẼN CHI PHÍ</div><div class="chat-itin-stat-val">${itin.estimatedCost || 'Đang ước tính'}</div></div>
                ${itin.transport ? `<div class="chat-itin-stat"><div class="chat-itin-stat-label">PHƯƠNG TIỆN</div><div class="chat-itin-stat-val">${itin.transport}</div></div>` : ''}
            </div>
        `;

        // Days timeline
        const daysHtml = (itin.itinerary || []).map((day, idx) => {
            const actsHtml = (day.activities || []).map(act => {
                // Format time range (08:00 → 08:00 - 10:00 if start/end exist)
                const timeLabel = act.timeEnd ? `${act.time} - ${act.timeEnd}` : (act.time || '');
                return `
                <div class="chat-itin-act-card">
                    <div class="chat-itin-act-time">${timeLabel}</div>
                    <div class="chat-itin-act-info">
                        <div class="chat-itin-act-name">${act.task || act.name || ''}</div>
                        ${act.location ? `<div class="chat-itin-act-loc">📍 ${act.location}</div>` : ''}
                        ${act.tip ? `<div class="chat-itin-act-tip">💡 ${act.tip}</div>` : ''}
                        ${act.cost ? `<span class="chat-itin-act-cost">🟢 ${act.cost}</span>` : ''}
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="chat-itin-day-block" style="animation-delay:${idx * 0.1}s">
                <div class="chat-itin-day-sidebar">
                    <div class="chat-itin-day-num">${day.day}</div>
                </div>
                <div class="chat-itin-day-content">
                    <div class="chat-itin-day-title">Ngày ${day.day}${day.title ? ` (${day.title})` : ''}</div>
                    ${day.subtitle ? `<div class="chat-itin-day-sub">${day.subtitle}</div>` : ''}
                    <div class="chat-itin-acts">${actsHtml}</div>
                </div>
            </div>`;
        }).join('');

        card.innerHTML = `
            <div class="chat-itin-hero">
                <div class="chat-itin-dest-pill">📍 ${(itin.destination || '').toUpperCase()}</div>
                <h3 class="chat-itin-hero-title">Hành trình khám phá ${itin.days || ''} ngày</h3>
                ${itin.tripSummary ? `<p class="chat-itin-hero-sub">${itin.tripSummary}</p>` : ''}
                ${statsHtml}
            </div>
            <div class="chat-itin-timeline">${daysHtml}</div>
            <div class="chat-itin-actions">
                <button class="btn-save-itin" type="button">💾 Lưu lịch trình này</button>
                <button class="btn-export-itin" type="button">📋 Sao chép</button>
            </div>
        `;

        // Nút Lưu
        card.querySelector('.btn-save-itin').onclick = async () => {
            const token = localStorage.getItem('wander_token');
            if (!token) { if (window.WanderUI) WanderUI.showToast('Đăng nhập để lưu lịch trình nhé!', 'warning'); return; }
            const btn = card.querySelector('.btn-save-itin');
            btn.textContent = '⏳ Đang lưu...';
            btn.disabled = true;
            try {
                const res = await fetch('/api/planner/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ planJson: itin, destination: itin.destination, days: itin.days }) });
                const d = await res.json();
                if (d.success) { btn.textContent = '✅ Đã lưu!'; if (window.WanderUI) WanderUI.showToast('Lịch trình đã lưu vào My Trips!', 'success'); }
                else { btn.textContent = '💾 Lưu lịch trình'; btn.disabled = false; }
            } catch(e) { btn.textContent = '💾 Lưu lịch trình'; btn.disabled = false; }
        };

        // Nút Sao chép
        card.querySelector('.btn-export-itin').onclick = () => {
            let text = `📍 Lịch trình ${itin.destination} - ${itin.days} ngày\n💰 ${itin.estimatedCost}\n\n`;
            (itin.itinerary || []).forEach(day => {
                text += `=== Ngày ${day.day}: ${day.title || ''} ===\n`;
                (day.activities || []).forEach(act => { text += `  ${act.time || ''} - ${act.task || act.name || ''} (${act.location || ''})\n`; });
                text += '\n';
            });
            navigator.clipboard?.writeText(text).then(() => { if (window.WanderUI) WanderUI.showToast('Đã sao chép lịch trình!', 'success'); });
        };

        log.appendChild(card);
        log.scrollTop = log.scrollHeight;
    }

    // Welcome message or resume session
    setTimeout(() => {
      loadSharedChat(); // Load instantly from cache
      if (currentSessionId) {
        loadChatHistory(currentSessionId); // Sync with server in background
      }
    }, 100);

    // Cross-tab Synchronization
    window.addEventListener('storage', (e) => {
      if (e.key === 'wander_shared_chat') {
        loadSharedChat();
      }
      if (e.key === 'wander_current_session') {
        currentSessionId = e.newValue;
      }
    });

    // Language Switcher Logic
    const langBtn = document.querySelector('#global-lang-switcher .chat-lang-btn');
    const langDropdown = document.getElementById('global-lang-dropdown');
    const langCode = document.getElementById('global-lang-code');
    const savedLang = localStorage.getItem('wander_chat_lang') || 'auto';

    if (langCode) langCode.textContent = savedLang.toUpperCase();

    if (langBtn && langDropdown) {
      langBtn.onclick = (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('is-active');
      };

      langDropdown.querySelectorAll('button').forEach(btn => {
        btn.onclick = function () {
          const lang = this.getAttribute('data-lang');
          localStorage.setItem('wander_chat_lang', lang);
          if (langCode) langCode.textContent = lang.toUpperCase();

          const placeholders = {
            'auto': 'Hỏi về du lịch Việt Nam…',
            'vi': 'Hỏi về du lịch Việt Nam…',
            'en': 'Ask about Vietnam tourism…',
            'jp': 'ベトナム観光について聞く…',
            'kr': '베트남 관광에 대해 hỏi…',
            'fr': 'Posez des questions sur le tourisme au Vietnam…'
          };
          input.placeholder = placeholders[lang] || placeholders['vi'];
          langDropdown.classList.remove('is-active');

          const confirmMsg = {
            'auto': 'Đã chuyển sang tự nhận diện ngôn ngữ.',
            'vi': 'Đã chuyển sang Tiếng Việt.',
            'en': 'Switched to English.',
            'jp': '日本語に切り替えました。',
            'kr': '한국어로 전환되었습니다.',
            'fr': 'Passé en français.'
          };
          appendMsg(confirmMsg[lang] || confirmMsg['vi'], 'bot');
        };
      });

      document.addEventListener('click', () => {
        langDropdown.classList.remove('is-active');
      });
    }

    // Expose internal functions for voice-helper.js and chat-brain.js
    window.WanderChat = {
      appendMsg: appendMsg,
      togglePanel: togglePanel,
      renderProposalCard: renderProposalCard,
      renderProposalOptions: renderProposalOptions,
      renderItineraryCard: renderItineraryCard,
      renderDiscoveryCarousel: renderDiscoveryCarousel,
      sendMessage: async (text) => {
        if (!text) return;
        
        // Trigger the form submission logic synthetically
        const form = document.getElementById('global-chat-form');
        const input = document.getElementById('global-chat-input');
        if (input) input.value = text;
        if (form) form.dispatchEvent(new Event('submit'));
      }
    };
    // Compatibility alias for chat-brain.js
    window.displayAIMessage = (data) => {
      if (typeof data === 'string') {
        appendMsg(data, 'bot');
      } else if (data && data.answer) {
        appendMsg(data.answer, 'bot');
        if (data.proposal) renderProposalCard(data.proposal);
        if (data.itineraryCard) renderItineraryCard(data.itineraryCard);
        if (data.proposals) renderProposalOptions(data.proposals);
        if (data.discoveryPlaces) renderDiscoveryCarousel(data.discoveryPlaces);
      }
    };
  }


  /* --- GLOBAL ACTIVITY STATS LOGIC --- */
  var chartInstances = {};

  function initStats() {
    if (!window.Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => runInitStats();
      document.head.appendChild(script);
    } else {
      runInitStats();
    }
  }

  function runInitStats() {
    const ctxIds = ['userActivityChart', 'userRadarChart', 'userRegionChart', 'userCategoryChart'];
    const contexts = ctxIds.map(id => document.getElementById(id));
    if (contexts.some(ctx => !ctx)) return;

    Object.values(chartInstances).forEach(i => i && i.destroy());

    const token = localStorage.getItem('wander_token');
    if (!token) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    // Hiển thị loading state
    document.querySelectorAll('[data-stat-trips], [data-stat-favs], [data-stat-chat], [data-stat-exp]').forEach(el => {
      el.textContent = '...';
    });

    fetch('/api/auth/user/stats', {
      headers: { 'x-auth-token': token }
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) return;

        const s = data.summary;
        const c = data.charts;

        // Cập nhật summary
        if (document.querySelector('[data-stat-trips]')) document.querySelector('[data-stat-trips]').textContent = s.trips;
        if (document.querySelector('[data-stat-favs]')) document.querySelector('[data-stat-favs]').textContent = s.favorites;
        if (document.querySelector('[data-stat-chat]')) document.querySelector('[data-stat-chat]').textContent = s.messages;
        if (document.querySelector('[data-stat-exp]')) document.querySelector('[data-stat-exp]').textContent = s.exp.toLocaleString();
        if (document.querySelector('[data-stat-rank]')) document.querySelector('[data-stat-rank]').textContent = 'Hạng: ' + s.rank;

        // 1. Hoạt động (Line Chart)
        const activityCtx = contexts[0].getContext('2d');
        const actGradient = activityCtx.createLinearGradient(0, 0, 0, 200);
        actGradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
        actGradient.addColorStop(1, 'rgba(0, 240, 255, 0)');

        chartInstances.line = new Chart(contexts[0], {
          type: 'line',
          data: {
            labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
            datasets: [{
              label: 'Hoạt động',
              data: c.activity,
              borderColor: '#00f0ff',
              borderWidth: 3,
              fill: true,
              backgroundColor: actGradient,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#00f0ff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: textColor } },
              y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }, beginAtZero: true }
            }
          }
        });

        // 2. Kỹ năng (Radar Chart)
        chartInstances.radar = new Chart(contexts[1], {
          type: 'radar',
          data: {
            labels: ['Khám phá', 'Kỹ năng', 'AI', 'Dịch vụ', 'Bền bỉ', 'Sở thích'],
            datasets: [{
              data: c.radar,
              backgroundColor: 'rgba(0, 85, 255, 0.2)',
              borderColor: '#0055ff',
              borderWidth: 2,
              pointRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              r: {
                grid: { color: gridColor },
                angleLines: { color: gridColor },
                pointLabels: { color: textColor, font: { size: 10 } },
                ticks: { display: false, max: 100 },
                suggestedMin: 0, suggestedMax: 100
              }
            }
          }
        });

        // 3. Vùng miền (Bar Chart)
        const regions = Object.keys(c.regions);
        const regionValues = Object.values(c.regions);
        chartInstances.region = new Chart(contexts[2], {
          type: 'bar',
          data: {
            labels: regions.length ? regions : ['Chưa có'],
            datasets: [{
              data: regionValues.length ? regionValues : [0],
              backgroundColor: ['#00f0ff', '#0055ff', '#f43f5e', '#10b981', '#fbbf24', '#8b5cf6'],
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: textColor } },
              y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }, beginAtZero: true }
            }
          }
        });

        // 4. Sở thích (Doughnut Chart)
        const interests = c.interests.slice(0, 5);
        chartInstances.cat = new Chart(contexts[3], {
          type: 'doughnut',
          data: {
            labels: interests.length ? interests : ['Chưa cập nhật'],
            datasets: [{
              data: interests.length ? interests.map(() => 1) : [1],
              backgroundColor: ['#00f0ff', '#8b5cf6', '#fbbf24', '#f43f5e', '#10b981'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } } },
            cutout: '75%'
          }
        });

      }).catch(err => {
        console.error('Lỗi tải thống kê:', err);
        document.querySelectorAll('[data-stat-trips], [data-stat-favs], [data-stat-chat], [data-stat-exp]').forEach(el => {
          el.textContent = 'Err';
        });
      });
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem('wander_session') || '{}');
    } catch (e) {
      return {};
    }
  }

  document.addEventListener('click', e => {
    // 1. Stats Modal
    const btnStats = e.target.closest('[data-open-activity]');
    if (btnStats) {
      const sess = getSession();
      if (!sess || !sess.email) {
        if (typeof showToast === 'function') showToast("Vui lòng đăng nhập để xem thống kê.", "info");
        openModal('auth');
        return;
      }
      openModal('activity-stats');
      if (window.initUserActivityCharts) setTimeout(window.initUserActivityCharts, 100);
      else if (typeof initStats === 'function') setTimeout(initStats, 100);
      toggleUserMenu(false);
      return;
    }

    // 2. Profile / Settings Modal
    const btnProfile = e.target.closest('[data-open-profile]');
    if (btnProfile) {
      toggleUserMenu(false);
      if (window.location.pathname.includes('profile.html')) {
        if (window.UserProfile && typeof window.UserProfile.toggleEditMode === 'function') {
          window.UserProfile.toggleEditMode(true);
          return;
        }
      }
      window.location.href = 'profile.html?edit=true';
      return;
    }

    const btnSettings = e.target.closest('[data-open-settings]');
    if (btnSettings) {
      toggleUserMenu(false);
      const sess = getSession();
      const isAuth = sess && sess.email;

      // Modal is assumed to be in index.html or injected
      const settingsModal = document.getElementById('modal-settings');
      if (settingsModal) {
        const appearanceTab = document.querySelector('[data-settings-tab="appearance"]');
        const securityTab = document.querySelector('[data-settings-tab="security"]');

        if (!isAuth && appearanceTab) appearanceTab.click();
        else if (securityTab) securityTab.click();

        // Populate profile data if auth
        if (isAuth) {
          const f = document.querySelector("[data-profile-form-v2]");
          if (f) {
            // Try to get profile from local or window (fallback to main.js globals)
            const p = (window.WanderUI_getProfile ? window.WanderUI_getProfile() : (window.getProfile ? window.getProfile() : {}));
            if (f.elements.displayName) f.elements.displayName.value = p.displayName || p.name || "";
            if (f.elements.notes) f.elements.notes.value = p.notes || "";
            if (f.elements.phone) f.elements.phone.value = p.phone || "";
            const avatarPreview = document.querySelector('[data-avatar-preview-img]');
            const avatarInitial = document.querySelector('[data-avatar-preview-initial]');
            if (avatarPreview && p.avatar) {
              avatarPreview.src = p.avatar;
              avatarPreview.hidden = false;
              if (avatarInitial) avatarInitial.style.display = 'none';
            } else if (avatarInitial) {
              avatarInitial.style.display = 'flex';
              if (avatarPreview) avatarPreview.hidden = true;
            }
          }
        }

        openModal('settings');
      } else {
        // Fallback for pages without standard settings modal yet
        if (typeof showToast === 'function') showToast("Tính năng cài đặt đang được đồng bộ...", "info");
      }
      return;
    }

    // 3. Settings Tab Switching (Global)
    const settingsTab = e.target.closest('[data-settings-tab]');
    if (settingsTab) {
      const target = settingsTab.getAttribute('data-settings-tab');
      document.querySelectorAll('[data-settings-tab]').forEach(t => t.classList.remove('is-active'));
      document.querySelectorAll('[data-settings-panel]').forEach(p => {
        p.hidden = true;
        p.classList.remove('is-active');
      });
      settingsTab.classList.add('is-active');
      const activePanel = document.querySelector(`[data-settings-panel="${target}"]`);
      if (activePanel) {
        activePanel.hidden = false;
        activePanel.classList.add('is-active');
      }
      return;
    }

    // 4. Theme Selection
    const themeOpt = e.target.closest('[data-theme-set]');
    if (themeOpt) {
      const theme = themeOpt.getAttribute('data-theme-set');
      setTheme(theme, true);
      document.querySelectorAll('[data-theme-set]').forEach(opt => opt.classList.remove('is-active'));
      themeOpt.classList.add('is-active');
      const autoThemeCheck = document.getElementById('auto-theme');
      if (autoThemeCheck) autoThemeCheck.checked = false;
      return;
    }

    // 5. Logout
    if (e.target.closest('[data-logout-btn], [data-logout]')) {
      forceLogout();
      return;
    }

    // 6. User Dropdown Toggle
    const btnToggle = e.target.closest('[data-user-toggle]');
    if (btnToggle) {
      e.stopPropagation();
      const dd = document.querySelector('[data-user-dropdown]');
      const isOpen = dd && !dd.hidden && dd.style.display !== 'none';
      toggleUserMenu(!isOpen);
      return;
    }

    // 7. Close Dropdown on outside click
    const bubble = document.querySelector('[data-user-bubble]');
    if (bubble && !bubble.contains(e.target)) {
      toggleUserMenu(false);
    }
  });

  // --- Settings Form Handlers ---
  function initSettingsHandlers() {
    // Password Form
    const pwdForm = document.querySelector('[data-password-form-v2]');
    if (pwdForm) {
      pwdForm.onsubmit = async (e) => {
        e.preventDefault();
        const status = document.querySelector('[data-password-status-v2]');
        const btn = pwdForm.querySelector('button[type="submit"]');
        const fd = new FormData(pwdForm);
        const data = Object.fromEntries(fd.entries());

        setButtonLoading(btn, true);
        if (status) status.textContent = "";

        try {
          const token = localStorage.getItem('wander_token');
          const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(data)
          });
          const json = await res.json();
          if (json.success) {
            showToast("Đổi mật khẩu thành công!", "success");
            pwdForm.reset();
          } else {
            if (status) {
              status.style.color = "var(--danger)";
              status.textContent = json.message || "Lỗi đổi mật khẩu";
            }
          }
        } catch (err) {
          showToast("Lỗi kết nối máy chủ", "error");
        } finally {
          setButtonLoading(btn, false);
        }
      };
    }

    // Auto Theme Checkbox
    const autoTheme = document.getElementById('auto-theme');
    if (autoTheme) {
      autoTheme.onchange = function () {
        if (this.checked) {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(isDark ? 'dark' : 'light', true);
          document.querySelectorAll('[data-theme-set]').forEach(opt => {
            opt.classList.toggle('is-active', opt.dataset.themeSet === (isDark ? 'dark' : 'light'));
          });
        }
      };
    }

    // Profile Form V2 (if exists in settings)
    const profileForm = document.querySelector('[data-profile-form-v2]');
    if (profileForm) {
      profileForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = profileForm.querySelector('button[type="submit"]');
        const fd = new FormData(profileForm);
        const data = Object.fromEntries(fd.entries());

        setButtonLoading(btn, true);
        try {
          const token = localStorage.getItem('wander_token');
          const res = await fetch('/api/auth/user/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(data)
          });
          const json = await res.json();
          if (json.success) {
            showToast("Cập nhật thông tin thành công!", "success");
            syncAuthUI(); // Refresh header
          } else {
            showToast(json.message || "Lỗi cập nhật", "error");
          }
        } catch (err) {
          showToast("Lỗi kết nối máy chủ", "error");
        } finally {
          setButtonLoading(btn, false);
        }
      };
    }
  }

  // --- Modal Utilities ---
  function openAuthModal(tab = 'login') {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    const backdrop = document.querySelector('[data-modal-backdrop]');
    if (backdrop) backdrop.hidden = false;

    // Switch to tab
    const tabs = document.querySelectorAll('[data-auth-tab]');
    tabs.forEach(t => {
      const active = t.dataset.authTab === tab;
      t.classList.toggle('is-active', active);
    });
    const panels = document.querySelectorAll('[data-auth-panel]');
    panels.forEach(p => p.hidden = p.dataset.authPanel !== tab);
  }

  function confirm(title, message) {
    return new Promise((resolve) => {
      const modalHtml = `
        <div id="temp-confirm-modal" class="modal" style="z-index: 11000;">
          <div class="modal__inner" style="max-width: 400px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div class="modal__header">
              <h3 class="modal__title">${title}</h3>
            </div>
            <div class="modal__body">
              <p style="color: var(--text-muted); line-height: 1.6;">${message}</p>
            </div>
            <div style="padding: 0 1.75rem 1.75rem; display: flex; gap: 10px;">
              <button class="btn btn--outline flex-1" id="confirm-cancel">Hủy</button>
              <button class="btn btn--danger flex-1" id="confirm-ok">Đồng ý</button>
            </div>
          </div>
        </div>
      `;
      const div = document.createElement('div');
      div.innerHTML = modalHtml;
      document.body.appendChild(div);

      const modal = document.getElementById('temp-confirm-modal');
      const backdrop = document.querySelector('[data-modal-backdrop]');
      if (backdrop) backdrop.hidden = false;
      modal.hidden = false;

      document.getElementById('confirm-cancel').onclick = () => {
        modal.remove();
        if (backdrop) backdrop.hidden = true;
        resolve(false);
      };
      document.getElementById('confirm-ok').onclick = () => {
        modal.remove();
        if (backdrop) backdrop.hidden = true;
        resolve(true);
      };
    });
  }

  // --- Init ---
  const initAll = () => {
    if (window.WanderUI_Initialized) return;
    window.WanderUI_Initialized = true;
    console.log("🚀 WanderUI Initializing components...");
    injectHeader();
    injectCommonComponents();
    initNavigation();
    updateNotificationBadge();

    // Hash-based modal opening (e.g. #auth)
    const handleHashModal = () => {
      const hash = window.location.hash;
      if (hash === '#auth') openAuthModal('login');
      if (hash === '#register') openAuthModal('register');
    };
    window.addEventListener('hashchange', handleHashModal);
    handleHashModal();
    syncAuthUI();
    initTheme();
    initGlobalChatbot();
    initSettingsHandlers();
    injectPerformanceHints();
    setupHoverPrefetch();
    injectGlobalStyles();
    setupLazyLoading();
  };

  function injectPerformanceHints() {
    const hints = [
      { rel: 'preconnect', href: window.location.origin },
      { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
      { rel: 'dns-prefetch', href: 'https://images.unsplash.com' }
    ];
    hints.forEach(h => {
      if (document.querySelector(`link[href="${h.href}"][rel="${h.rel}"]`)) return;
      const link = document.createElement('link');
      Object.assign(link, h);
      document.head.appendChild(link);
    });
  }

  function setupHoverPrefetch() {
    // Prefetch API data when user hovers over a navigation link
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('a');
      if (!link || !link.href || !link.href.startsWith(window.location.origin)) return;

      const page = link.href.split('/').pop().split('#')[0].split('?')[0];
      if (!page) return;

      const token = localStorage.getItem('wander_token');
      if (!token) return;

      if (page === 'leaderboard.html') {
        prefetchAPI('/api/auth/leaderboard');
      } else if (page === 'social-hub.html') {
        prefetchAPI('/api/social/stories');
        prefetchAPI('/api/social/feed');
      } else if (page === 'quests.html') {
        prefetchAPI('/api/auth/user/rank');
        prefetchAPI('/api/auth/user/activity');
      } else if (page === 'profile.html') {
        const url = new URL(link.href);
        const id = url.searchParams.get('id');
        if (id) {
          prefetchAPI(`/api/social/users/${id}`);
          prefetchAPI(`/api/social/posts/user/${id}`);
        } else {
          prefetchAPI('/api/auth/user/me');
        }
      }
    }, { passive: true });
  }

  const _prefetchCache = new Set();
  function prefetchAPI(url) {
    if (_prefetchCache.has(url)) return;
    _prefetchCache.add(url);

    // Check if already in sessionStorage and fresh
    const cacheKey = 'wv_prefetch_' + url;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30000) return; // Still fresh
      } catch (e) { }
    }

    console.log(`🚀 Big-Tech Prefetch: ${url}`);
    const token = localStorage.getItem('wander_token') || localStorage.getItem('wander_admin_token');
    fetch(url, { headers: { 'x-auth-token': token } })
      .then(res => res.json())
      .then(data => {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      })
      .catch(() => _prefetchCache.delete(url));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  function injectGlobalStyles() {
    if (document.getElementById('wv-global-performance-styles')) return;
    const style = document.createElement('style');
    style.id = 'wv-global-performance-styles';
    style.innerHTML = `
      #wv-top-loader {
        position: fixed; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, #fbbf24, #f43f5e, #fbbf24);
        background-size: 200% 100%;
        z-index: 9999999;
        transform-origin: left;
        transform: scaleX(0);
        transition: transform 0.4s cubic-bezier(0.1, 0.7, 1, 0.1), opacity 0.3s;
        pointer-events: none;
      }
      #wv-top-loader.loading { transform: scaleX(0.7); animation: loaderShimmer 2s infinite linear; }
      #wv-top-loader.finished { transform: scaleX(1); opacity: 0; transition: transform 0.2s, opacity 0.4s 0.2s; }
      @keyframes loaderShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .loading-shimmer {
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
        background-size: 200% 100%;
        animation: loadingShimmer 1.5s infinite;
      }
      @keyframes loadingShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      [data-theme="light"] .loading-shimmer {
        background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 75%);
        background-size: 200% 100%;
      }
    `;
    document.head.appendChild(style);

    const loader = document.createElement('div');
    loader.id = 'wv-top-loader';
    document.body.appendChild(loader);
  }

  function startTopLoader() {
    const loader = document.getElementById('wv-top-loader');
    if (loader) {
      loader.classList.remove('finished');
      loader.classList.add('loading');
    }
  }

  function finishTopLoader() {
    const loader = document.getElementById('wv-top-loader');
    if (loader) {
      loader.classList.remove('loading');
      loader.classList.add('finished');
    }
  }

  // Hijack all internal links for the top loader
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href || link.target === '_blank') return;
    if (link.href.startsWith(window.location.origin) && !link.href.includes('#')) {
      startTopLoader();
    }
  });

  function setupLazyLoading() {
    // Big-Tech Pattern: IntersectionObserver for images
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, { rootMargin: '200px' });

    let lazyTimeout;
    const refreshLazy = () => {
      clearTimeout(lazyTimeout);
      lazyTimeout = setTimeout(() => {
        document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
      }, 150);
    };

    refreshLazy();
    // MutationObserver to watch for newly added images - debounced to avoid lag
    const mut = new MutationObserver((mutations) => {
      const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
      if (hasNewNodes) refreshLazy();
    });
    mut.observe(document.body, { childList: true, subtree: true });
  }

  injectGlobalStyles(); // Pre-inject

  return { setTheme, toggleTheme, showToast, setButtonLoading, toggleNotificationDrawer, updateNotificationBadge, markAsRead, markAllAsRead, syncAuthUI, forceLogout, toggleUserMenu, openAuthModal, confirm, openPlaceDetail, getRankBadgeHTML, getRankIcon, getStoreKey, initSettingsHandlers, trackQuestActivity, getQuestActivity, startTopLoader, finishTopLoader };
})());


