/* ============================================================
   biz-extend.js — Extended Business Dashboard Functionality
   Xử lý: navigation views, analytics, messages, promo form, CSV export
   ============================================================ */
(function () {
  'use strict';
  function getToken() {
    return localStorage.getItem('biz_auth_token') || 
           sessionStorage.getItem('biz_auth_token') ||
           localStorage.getItem('wander_business_token') || 
           sessionStorage.getItem('wander_business_token') ||
           localStorage.getItem('biz_token') ||
           sessionStorage.getItem('biz_token') ||
           localStorage.getItem('wander_token'); 
  }

  var API = window.location.origin;

  async function apiFetch(url, options) {
    if (window.api && typeof window.api.get === 'function') {
      try {
        var method = (options && options.method || 'GET').toLowerCase();
        var config = { headers: (options && options.headers) || {} };
        if (method === 'get') return await window.api.get(url, config);
        if (method === 'post') return await window.api.post(url, options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {}, config);
        if (method === 'put') return await window.api.put(url, options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {}, config);
        if (method === 'delete') return await window.api.delete(url, config);
      } catch (err) {
        console.warn('[apiFetch Extension] Fallback to local due to:', err.message);
      }
    }
    var token = getToken();
    options = options || {};
    options.headers = options.headers || {};
    if (token) {
      options.headers['x-auth-token'] = token;
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    
    return fetch(url, options).then(function (r) {
      if (r.status === 401) {
        console.warn('[apiFetch] 401 Unauthorized - Yêu cầu đăng nhập lại.');
        // Redirect if we are on index.html or root (/)
        if (token || window.location.pathname.includes('index.html') || window.location.pathname === '/') {
           setTimeout(function() { window.location.href = 'dashboard.html'; }, 2000);
        }
      }
      return r.json();
    });
  }

  // Global logout function
  window.bizLogout = function() {
    localStorage.removeItem('biz_auth_token');
    sessionStorage.removeItem('biz_auth_token');
    localStorage.removeItem('wander_business_token');
    sessionStorage.removeItem('wander_business_token');
    window.location.href = 'dashboard.html';
  };

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function timeAgo(d) {
    if (!d) return '';
    var diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    return Math.floor(diff / 86400) + ' ngày trước';
  }

  // ─── View Navigation ──────────────────────────────────────
  var VIEWS = {
    'public-home': { el: 'public-home-view', label: 'Trang chủ Website',     load: function() { if(window.initPublicHome) window.initPublicHome(); } },
    home:      { el: 'home-view',     label: 'Dashboard Tổng quan',      load: function() { if(window.initOverview) window.initOverview(); } },
    overview:  { el: 'home-view',     label: 'Trang chủ',             load: function() { if(window.initOverview) window.initOverview(); } },
    profile:   { el: 'profile-view',  label: 'Hồ sơ doanh nghiệp',   load: function() { if(window.initProfile) window.initProfile(); } },
    dashboard: { el: 'dashboard-view', label: 'Bảng điều khiển' },
    services:  { el: 'services-view',  label: 'Quản lý dịch vụ',     load: function() { if(window.initServiceManagement) window.initServiceManagement(); } },
    bookings:  { el: 'bookings-view',  label: 'Quản lý đơn hàng',    load: function() { if(window.initBookingManagement) window.initBookingManagement(); } },
    messages:  { el: 'messages-view',  label: 'Tin nhắn khách hàng',  load: function() { if(window.initMessageManagement) window.initMessageManagement(); } },
    reviews:   { el: 'reviews-view',   label: 'Đánh giá dịch vụ',       load: function() { if(window.initReviewManagement) window.initReviewManagement(); } },
    'user-activity': { el: 'user-activity-view', label: 'Hoạt động người dùng', load: function() { if(window.initUserActivity) window.initUserActivity(); } },
    'business-performance': { el: 'business-performance-view', label: 'Hiệu suất kinh doanh', load: function() { if(window.initBusinessPerformance) window.initBusinessPerformance(); } },
    support:   { el: 'support-view',   label: 'Hỗ trợ đối tác', load: loadSupport }
  };

  function loadSupport() {
    var container = document.getElementById('support-history-list');
    if (!container) return;
    
    apiFetch(API + '/api/feedback/my-feedbacks')
      .then(function(json) {
        if (!json.success) throw new Error(json.message);
        var list = json.data || [];
        if (!list.length) {
          container.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Bạn chưa có yêu cầu hỗ trợ nào.</div>';
          return;
        }
        
        container.innerHTML = list.map(function(f) {
          var statusColor = f.status === 'open' ? '#22c55e' : '#94a3b8';
          var statusText = f.status === 'open' ? 'Đang mở' : 'Đã đóng';
          var imgHtml = f.image ? '<div style="margin-top:10px;"><img src="'+f.image+'" style="max-width:200px; border-radius:8px; border:1px solid #eee; cursor:zoom-in;" onclick="window.open(\''+f.image+'\')"></div>' : '';
          
          var repliesHtml = (f.replies || []).map(function(r) {
            var isAdmin = r.senderRole === 'admin';
            var rImgHtml = r.image ? '<div style="margin-top:6px;"><img src="'+r.image+'" style="max-width:150px; border-radius:6px; cursor:zoom-in;" onclick="window.open(\''+r.image+'\')"></div>' : '';
            return '<div style="margin-bottom:0.75rem; display:flex; flex-direction:column; align-items:'+(isAdmin?'flex-start':'flex-end')+'">' +
              '<div style="max-width:85%; padding:0.6rem 1rem; border-radius:12px; font-size:13px; background:'+(isAdmin?'rgba(118,75,162,0.1)':'#764ba2')+'; color:'+(isAdmin?'#1a1a2e':'#fff')+'">' +
                '<strong>'+esc(r.senderName)+':</strong> ' + esc(r.content) + rImgHtml +
                '<div style="font-size:10px; opacity:0.6; margin-top:4px;">'+timeAgo(r.createdAt)+'</div>' +
              '</div></div>';
          }).join('');

          return '<div style="border:1px solid #f0f0f5; border-radius:16px; padding:1.25rem; background:#fff;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #f8f9ff; padding-bottom:0.75rem;">' +
              '<div><span style="font-size:11px; color:#888;">#'+f._id.substring(18)+'</span><h5 style="font-size:15px; margin-top:2px;">'+esc(f.name || 'Yêu cầu hỗ trợ')+'</h5></div>' +
              '<span style="font-size:11px; font-weight:700; color:'+statusColor+'; background:'+statusColor+'15; padding:4px 10px; border-radius:20px;">'+statusText+'</span>' +
            '</div>' +
            '<div style="font-size:13px; color:#444; margin-bottom:1rem; background:#f9fafb; padding:1rem; border-radius:10px;">'+esc(f.message) + imgHtml + '</div>' +
            '<div style="margin-top:1rem; padding-top:1rem; border-top:1px dashed #f0f0f5;">'+repliesHtml+'</div>' +
            (f.status === 'open' ? 
              '<div style="margin-top:1rem;">' +
                '<div id="reply-preview-'+f._id+'" style="display:none; margin-bottom:8px; position:relative; width:60px; height:60px; border-radius:6px; overflow:hidden; border:1px solid #eee;">' +
                  '<img src="" style="width:100%; height:100%; object-fit:cover;">' +
                  '<div style="position:absolute; top:0; right:0; background:rgba(0,0,0,0.5); color:#fff; width:15px; height:15px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="window.clearReplyImage(\''+f._id+'\')">×</div>' +
                '</div>' +
                '<div style="display:flex; gap:0.5rem; align-items:center;">' +
                  '<button style="background:none; border:none; font-size:18px; cursor:pointer;" onclick="document.getElementById(\'reply-file-'+f._id+'\').click()">🖼️</button>' +
                  '<input type="file" id="reply-file-'+f._id+'" hidden accept="image/*" onchange="window.handleReplyImage(this, \''+f._id+'\')">' +
                  '<input type="text" id="biz-reply-'+f._id+'" placeholder="Nhập phản hồi..." style="flex:1; padding:0.6rem; border-radius:8px; border:1px solid #e8e8f0; font-size:13px;">' +
                  '<button class="btn-submit-support-action" style="padding:8px 18px; font-size:12px; background:var(--primary); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;" onclick="window.bizFeedbackReply(\''+f._id+'\')">Gửi</button>' +
                '</div>' +
              '</div>' : ''
            ) +
          '</div>';
        }).join('');
      })
      .catch(function(e) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:#ef4444;">Lỗi: '+e.message+'</div>';
      });
  }

  var supportImageBase64 = null;
  window.handleSupportImage = function(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      supportImageBase64 = e.target.result;
      document.getElementById('support-image-status').textContent = file.name;
      var preview = document.getElementById('support-image-preview');
      preview.style.display = 'block';
      preview.querySelector('img').src = supportImageBase64;
    };
    reader.readAsDataURL(file);
  }

  window.clearSupportImage = function() {
    supportImageBase64 = null;
    document.getElementById('support-image-input').value = '';
    document.getElementById('support-image-status').textContent = 'Chưa có ảnh';
    document.getElementById('support-image-preview').style.display = 'none';
  }

  window.submitSupport = function() {
    var title = document.getElementById('support-title').value.trim();
    var msg = document.getElementById('support-message').value.trim();
    var btn = document.getElementById('btn-submit-support');
    
    if (!title || !msg) { alert('Vui lòng nhập đầy đủ tiêu đề và nội dung.'); return; }
    
    btn.disabled = true;
    btn.textContent = 'Đang gửi...';
    
    apiFetch(API + '/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ 
        name: title, 
        email: 'business@partner.com', 
        message: msg,
        image: supportImageBase64
      })
    }).then(function(json) {
      if (json.success) {
        if (window.WanderUI && window.WanderUI.showToast) {
            window.WanderUI.showToast('Gửi yêu cầu hỗ trợ thành công!', 'success');
        } else {
            alert('Gửi yêu cầu hỗ trợ thành công!');
        }
        document.getElementById('support-title').value = '';
        document.getElementById('support-message').value = '';
        window.clearSupportImage();
        loadSupport();
      } else {
        alert('Lỗi: ' + json.message);
      }
    }).finally(function() {
      btn.disabled = false;
      btn.textContent = 'Gửi yêu cầu ngay';
    });
  }

  window.bizFeedbackReply = function(id) {
    var inp = document.getElementById('biz-reply-' + id);
    if (!inp) return;
    var content = inp.value.trim();
    var image = replyImages[id] || null;
    
    if (!content && !image) return;
    
    apiFetch(API + '/api/feedback/' + id + '/reply', {
      method: 'POST',
      body: JSON.stringify({ content: content, image: image })
    }).then(function(json) {
      if (json.success) {
        delete replyImages[id];
        loadSupport();
      } else {
        alert('Lỗi: ' + (json.message || 'Không thể gửi phản hồi'));
      }
    });
  }

  var replyImages = {};
  window.handleReplyImage = function(input, id) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      replyImages[id] = e.target.result;
      var preview = document.getElementById('reply-preview-' + id);
      preview.style.display = 'block';
      preview.querySelector('img').src = replyImages[id];
    };
    reader.readAsDataURL(file);
  }

  window.clearReplyImage = function(id) {
    delete replyImages[id];
    document.getElementById('reply-file-' + id).value = '';
    document.getElementById('reply-preview-' + id).style.display = 'none';
  }

  function showView(viewKey) {
    // Hide all views
    document.querySelectorAll('.biz-view').forEach(function (v) {
      v.style.display = 'none';
    });
    // Mark all nav items inactive
    document.querySelectorAll('[data-view]').forEach(function (a) {
      a.classList.remove('active');
    });

    var cfg = VIEWS[viewKey];
    if (!cfg) return;

    // Save active view state to persist across reloads
    localStorage.setItem('biz_active_view', viewKey);

    // Show target view
    var targetEl = document.getElementById(cfg.el);
    if (targetEl) targetEl.style.display = '';

    // Update active nav
    var navItem = document.querySelector('[data-view="' + viewKey + '"]');
    if (navItem) navItem.classList.add('active');

    // Update breadcrumb and Title
    var bc = document.getElementById('biz-breadcrumb');
    if (bc) bc.textContent = 'Bảng điều khiển đối tác / ' + cfg.label;
    
    var titleEl = document.querySelector('.topbar-left h2');
    if (titleEl) titleEl.textContent = cfg.label;

    // Load data if needed
    if (cfg.load) cfg.load();
  }

  window.navigateToView = showView;

  // Bind nav clicks
  document.querySelectorAll('[data-view]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showView(a.getAttribute('data-view'));
    });
  });

  // ─── Analytics ────────────────────────────────────────────
  var analyticsData = null;

  function loadAnalytics() {
    var tbody = document.getElementById('analytics-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8;">Đang tải...</td></tr>';

    apiFetch(API + '/api/business/analytics')
      .then(function (json) {
        if (!json.success) throw new Error(json.message || 'Lỗi');
        analyticsData = json.data;
        var d = json.data;

        // Fill stats
        var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
        set('an-views',    (d.totalViews   || 0).toLocaleString('vi-VN'));
        set('an-reviews',  (d.totalReviews || 0).toLocaleString('vi-VN'));
        set('an-services', (d.totalServices|| 0).toLocaleString('vi-VN'));
        set('an-rating',   d.avgRating ? d.avgRating + '/5' : '—');

        // Fill table
        if (tbody) {
          if (!d.places || d.places.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8;">Chưa có dịch vụ nào.</td></tr>';
          } else {
            tbody.innerHTML = d.places.map(function (p) {
              var statusBadge = p.status === 'approved'
                ? '<span style="background:rgba(16,185,129,0.15);color:#34d399;padding:0.2rem 0.55rem;border-radius:6px;font-size:0.72rem;font-weight:600;">✅ Đã duyệt</span>'
                : p.status === 'pending'
                ? '<span style="background:rgba(245,158,11,0.15);color:#fbbf24;padding:0.2rem 0.55rem;border-radius:6px;font-size:0.72rem;font-weight:600;">⏳ Chờ duyệt</span>'
                : '<span style="background:rgba(239,68,68,0.15);color:#f87171;padding:0.2rem 0.55rem;border-radius:6px;font-size:0.72rem;font-weight:600;">❌ Từ chối</span>';
              return '<tr>' +
                '<td><strong>' + esc(p.name) + '</strong><br><small style="color:#94a3b8;">' + esc(p.region || '') + '</small></td>' +
                '<td>' + (p.favoritesCount || 0).toLocaleString('vi-VN') + '</td>' +
                '<td>' + (p.reviewCount || 0).toLocaleString('vi-VN') + '</td>' +
                '<td>' + (p.ratingAvg ? '⭐ ' + p.ratingAvg : '—') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '</tr>';
            }).join('');
          }
        }
      })
      .catch(function (err) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#f87171;">Lỗi tải dữ liệu: ' + esc(err.message) + '</td></tr>';
      });
  }

  // ─── CSV Export ───────────────────────────────────────────
  var btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', function () {
      if (!analyticsData || !analyticsData.places || analyticsData.places.length === 0) {
        alert('Chưa có dữ liệu để xuất. Hãy tải trang thống kê trước.');
        return;
      }
      var rows = [['Tên dịch vụ', 'Khu vực', 'Lượt xem', 'Đánh giá', 'Rating TB', 'Trạng thái']];
      analyticsData.places.forEach(function (p) {
        rows.push([
          p.name || '',
          p.region || '',
          p.favoritesCount || 0,
          p.reviewCount || 0,
          p.ratingAvg || '',
          p.status || ''
        ]);
      });
      var csv = rows.map(function (r) {
        return r.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bao-cao-dich-vu-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ─── Promo Form ───────────────────────────────────────────
  var promoForm = document.getElementById('promo-form');
  if (promoForm) {
    promoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var title   = (document.getElementById('promo-title')   || {}).value || '';
      var message = (document.getElementById('promo-message') || {}).value || '';
      var statusEl = document.getElementById('promo-status');
      if (!title || !message) {
        if (statusEl) { statusEl.textContent = '⚠️ Vui lòng điền đủ tiêu đề và nội dung.'; statusEl.style.color = '#f59e0b'; }
        return;
      }
      var btn = promoForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

      apiFetch(API + '/api/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title: title, message: message, recipientType: 'ALL' })
      })
      .then(function (json) {
        if (json.success) {
          if (statusEl) { statusEl.textContent = '✅ Đã gửi thông báo thành công!'; statusEl.style.color = '#34d399'; }
          promoForm.reset();
          setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 4000);
        } else {
          if (statusEl) { statusEl.textContent = '❌ ' + (json.message || 'Gửi thất bại.'); statusEl.style.color = '#f87171'; }
        }
      })
      .catch(function () {
        if (statusEl) { statusEl.textContent = '❌ Lỗi kết nối máy chủ.'; statusEl.style.color = '#f87171'; }
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = '📨 Gửi thông báo'; }
      });
    });
  }

  // ─── Messages / Reviews ───────────────────────────────────
  var currentMsgTab = 'reviews';

  function loadMessages() {
    var container = document.getElementById('messages-list');
    if (!container) return;

    // Inject tabs nếu chưa có
    if (!document.getElementById('msg-tab-bar')) {
      var tabHtml = '<div id="msg-tab-bar" style="display:flex;gap:0.5rem;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:0.5rem;">' +
        '<button id="msg-tab-reviews" onclick="switchMsgTab(\'reviews\')" style="padding:0.5rem 1.1rem;border-radius:8px 8px 0 0;border:none;background:rgba(99,102,241,0.15);color:#818cf8;font-weight:700;cursor:pointer;">⭐ Đánh giá (<span id="cnt-reviews">...</span>)</button>' +
        '<button id="msg-tab-inbox" onclick="switchMsgTab(\'inbox\')" style="padding:0.5rem 1.1rem;border-radius:8px 8px 0 0;border:none;background:transparent;color:#94a3b8;font-weight:700;cursor:pointer;">💬 Tin nhắn (<span id="cnt-inbox">...</span>)</button>' +
      '</div><div id="msg-content"></div>';
      container.innerHTML = tabHtml;
    }

    switchMsgTab(currentMsgTab);
  }

  window.switchMsgTab = function(tab) {
    currentMsgTab = tab;
    var rBtn = document.getElementById('msg-tab-reviews');
    var iBtn = document.getElementById('msg-tab-inbox');
    if (rBtn) rBtn.style.background = tab==='reviews' ? 'rgba(99,102,241,0.15)' : 'transparent';
    if (rBtn) rBtn.style.color = tab==='reviews' ? '#818cf8' : '#94a3b8';
    if (iBtn) iBtn.style.background = tab==='inbox' ? 'rgba(99,102,241,0.15)' : 'transparent';
    if (iBtn) iBtn.style.color = tab==='inbox' ? '#818cf8' : '#94a3b8';
    if (tab==='reviews') loadReviews(); else loadInbox();
  };

  function loadReviews() {
    var mc = document.getElementById('msg-content');
    if (mc) mc.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">Đang tải...</div>';
    apiFetch(API + '/api/business/reviews')
      .then(function(json) {
        var reviews = (json.success && json.data) ? json.data : [];
        var cntEl = document.getElementById('cnt-reviews');
        if (cntEl) cntEl.textContent = reviews.length;
        if (!mc) return;
        if (!reviews.length) { mc.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8;">📭 Chưa có đánh giá nào.</div>'; return; }
        mc.innerHTML = reviews.map(function(r) {
          var stars = '★'.repeat(Math.min(r.rating||0,5)) + '☆'.repeat(Math.max(0,5-(r.rating||0)));
          var ini = (r.userName||r.name||'K')[0].toUpperCase();
          var clr = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444'][ini.charCodeAt(0)%5];
          return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1.25rem;display:flex;gap:1rem;margin-bottom:0.75rem;">' +
            '<div style="width:40px;height:40px;border-radius:50%;background:'+clr+';display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">'+ini+'</div>' +
            '<div style="flex:1;">' +
              '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.3rem;">' +
                '<strong>'+esc(r.userName||r.name||'Khách')+'</strong>' +
                '<span style="color:#fbbf24;">'+stars+'</span>' +
                '<span style="font-size:0.78rem;color:#94a3b8;">'+esc(r.placeName||'')+'</span>' +
                '<span style="margin-left:auto;font-size:0.75rem;color:#64748b;">'+timeAgo(r.createdAt)+'</span>' +
              '</div>' +
              '<p style="margin:0;color:#cbd5e1;font-size:0.88rem;line-height:1.6;">'+esc(r.text||r.message||'')+'</p>' +
            '</div></div>';
        }).join('');
      }).catch(function(e){ if(mc) mc.innerHTML='<p style="color:#f87171;text-align:center;">Lỗi tải đánh giá.</p>'; });
  }

  function loadInbox() {
    var mc = document.getElementById('msg-content');
    if (mc) mc.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;">Đang tải...</div>';
    apiFetch(API + '/api/business/messages')
      .then(function(json) {
        var convs = (json.success && json.data) ? json.data : [];
        var cntEl = document.getElementById('cnt-inbox');
        if (cntEl) cntEl.textContent = convs.length;
        if (!mc) return;
        if (!convs.length) { mc.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8;">💬 Chưa có tin nhắn nào.</div>'; return; }
        mc.innerHTML = convs.map(function(c) {
          var unread = c.unreadCount > 0 ? '<span style="background:#ef4444;color:#fff;border-radius:50px;padding:0.1rem 0.5rem;font-size:0.72rem;font-weight:700;margin-left:0.5rem;">'+c.unreadCount+' mới</span>' : '';
          var msgs = (c.messages||[]).map(function(m){
            var isBiz = m.senderRole==='business';
            return '<div style="display:flex;justify-content:'+(isBiz?'flex-end':'flex-start')+';margin-bottom:0.4rem;">'+
              '<div style="max-width:80%;padding:0.5rem 0.8rem;border-radius:12px;background:'+(isBiz?'#6366f1':'rgba(255,255,255,0.08)')+';color:#fff;font-size:0.85rem;">'+esc(m.text)+'<span style="display:block;font-size:0.7rem;opacity:0.6;margin-top:0.2rem;">'+timeAgo(m.createdAt)+'</span></div></div>';
          }).join('');
          return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1.25rem;margin-bottom:0.75rem;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"><strong>'+esc(c.customerName||'Khách')+'</strong>'+unread+'<span style="margin-left:auto;font-size:0.75rem;color:#64748b;">'+timeAgo(c.time)+'</span></div>' +
            '<div style="max-height:200px;overflow-y:auto;padding:0.5rem;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:0.75rem;">'+msgs+'</div>' +
            '<div style="display:flex;gap:0.5rem;">' +
              '<input type="text" id="reply-'+esc(c.customerId)+'" placeholder="Nhập phản hồi..." style="flex:1;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;font-size:0.85rem;" />' +
              '<button onclick="bizReply(\''+esc(c.customerId)+'\',\''+esc(c.customerName||'Khách')+'\')" style="padding:0.5rem 1rem;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Gửi</button>' +
            '</div></div>';
        }).join('');
      }).catch(function(){ if(mc) mc.innerHTML='<p style="color:#f87171;text-align:center;">Lỗi tải tin nhắn.</p>'; });
  }

  window.bizReply = function(customerId, customerName) {
    var inp = document.getElementById('reply-'+customerId);
    if (!inp || !inp.value.trim()) return;
    var text = inp.value.trim();
    inp.value = '';
    apiFetch(API + '/api/business/messages', {
      method: 'POST',
      body: JSON.stringify({ customerId: customerId, customerName: customerName, text: text })
    }).then(function(json){
      if (json.success) loadInbox();
      else alert('Lỗi gửi: ' + (json.message||''));
    });
  };

  // ─── User landing page: load real stats ──────────────────
  // (Chỉ chạy trên port 3000 / user portal, nhưng giữ lại để tránh lỗi ReferenceError)
  function loadPublicStats() {
    var statEls = {
      users:   document.querySelector('.stat-number[data-stat="users"]'),
      places:  document.querySelector('.stat-number[data-stat="places"]'),
      reviews: document.querySelector('.stat-number[data-stat="reviews"]')
    };
    if (!statEls.users && !statEls.places) return; 

    fetch(API + '/api/public/stats')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json.success) return;
        var d = json.data;
        if (statEls.users  && d.userCount  !== undefined) statEls.users.textContent  = (d.userCount  || 0).toLocaleString('vi-VN') + '+';
        if (statEls.places && d.placeCount !== undefined) statEls.places.textContent = (d.placeCount || 0).toLocaleString('vi-VN') + '+';
        if (statEls.reviews && d.feedbackCount !== undefined) statEls.reviews.textContent = (d.feedbackCount || 0).toLocaleString('vi-VN') + '+';
      })
      .catch(function () { });
  }

  // ─── Real Data Sync ──────────────────────────────────────
  window.syncAllData = function() {
    var token = getToken();
    if (!token) return;
    console.log('[biz-extend] Bắt đầu đồng bộ dữ liệu thực tế...');
    
    // Cập nhật tên hiển thị từ Token (nếu có)
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      var nameEl = document.querySelector('.user-chip');
      if (nameEl && payload.displayName) {
        nameEl.innerHTML = '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff">🏨</div>' + payload.displayName + ' ▾';
      }
    } catch(e) {}

    // 1. Sync Stats
    apiFetch(API + '/api/business/stats')
      .then(function(json) {
        if (json.success && json.data) {
          const d = json.data;
          const container = document.getElementById('dashboard-stats');
          if (container) {
            const mockStats = {
              totalServices: d.totalServices || 0,
              totalBookings: d.totalBookings || 0,
              totalRevenue: (d.totalRevenue || 0),
              avgRating: d.avgRating || '0.0',
              ratedServicesCount: d.totalServices || 0
            };
            const revenueStr = (mockStats.totalRevenue / 1000000).toFixed(1) + 'M';
            container.innerHTML = `
              <div class="stats">
                <div class="stat">
                  <div class="stat-icon si-blue">🧳</div>
                  <div class="stat-label">Tổng dịch vụ</div>
                  <div class="stat-num">${mockStats.totalServices}</div>
                  <div class="stat-trend">Cập nhật lúc này</div>
                </div>
                <div class="stat">
                  <div class="stat-icon si-blue">📅</div>
                  <div class="stat-label">Đơn đặt chỗ</div>
                  <div class="stat-num">${mockStats.totalBookings}</div>
                  <div class="stat-trend">Cập nhật lúc này</div>
                </div>
                <div class="stat">
                  <div class="stat-icon si-purple">💰</div>
                  <div class="stat-label">Doanh thu</div>
                  <div class="stat-num" style="font-size:21px">
                    ${revenueStr} <span style="font-size:13px;font-weight:500">VND</span>
                  </div>
                  <div class="stat-trend">Từ đơn đã xác nhận</div>
                </div>
                <div class="stat">
                  <div class="stat-icon si-yellow">⭐</div>
                  <div class="stat-label">Đánh giá trung bình</div>
                  <div class="stat-num">
                    ${mockStats.avgRating}<span style="font-size:15px;font-weight:500">/5</span>
                  </div>
                  <div class="stat-trend">Từ ${mockStats.ratedServicesCount} dịch vụ</div>
                </div>
              </div>`;
          }
        }
      });

    // 2. Sync Places
    apiFetch(API + '/api/business/places')
      .then(function(json) {
        if (json.success && json.data) {
          const mappedServices = json.data.map(p => ({
            id: p.id || p._id,
            name: p.name,
            type: p.kind === 'diem-du-lich' ? 'Tour' : 'Dịch vụ',
            location: p.region || p.address,
            price: p.priceFrom || 500000,
            unit: 'người',
            rating: parseFloat(p.ratingAvg || 0),
            bookings: p.reviewCount || 0,
            status: p.status === 'approved' ? 'active' : (p.status === 'rejected' ? 'paused' : 'pending'),
            image: p.image || 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=600'
          }));
          if (typeof initServiceFilter === 'function') {
            window.getAllServices = function() { return mappedServices; };
            initServiceFilter('tab-bar', 'service-grid');
          }
        }
      });

    // 3. Sync Bookings (Dữ liệu thực từ /api/bookings)
    apiFetch(API + '/api/bookings')
      .then(function(json) {
        if (json.success && json.data) {
          const bookings = json.data;
          // Update booking stat in dashboard
          var statBookingEl = document.getElementById('stat-bookings');
          if (statBookingEl) statBookingEl.textContent = bookings.length;
          // Update revenue stat
          var confirmedTotal = bookings.filter(function(b){ return b.status==='confirmed'||b.status==='completed'; })
                                        .reduce(function(s,b){ return s+(b.totalPrice||0); },0);
          var statRevEl = document.getElementById('stat-revenue');
          if (statRevEl) statRevEl.textContent = (confirmedTotal/1000000).toFixed(1)+'M VNĐ';

          if (typeof renderBookings === 'function') {
            const mappedBookings = bookings.map(b => ({
              id: (b.bookingId || b._id || '').toString().slice(-6).toUpperCase(),
              rawId: b._id,
              customerName: b.customerName || (b.user && b.user.name) || 'Khách hàng',
              serviceName: b.service?.name || b.placeName || '—',
              bookingDate: fmtDate(b.createdAt),
              useDate: fmtDate(b.date || b.tourDate || b.useDate),
              value: b.totalPrice || 0,
              status: b.status,
              paymentMethod: b.paymentMethod,
              paymentStatus: b.paymentStatus || (b.paymentMethod === 'contact' ? 'unpaid' : 'paid') // Fallback logic
            }));
            renderBookings(mappedBookings, 'booking-table', { limit: 10, title: 'Đơn đặt chỗ mới từ khách hàng' });
          }
        }
      });
  };

  // Hàm toàn cục để bookingTable.js có thể gọi
  window.updateBookingStatus = function(id, newStatus) {
    if (!confirm('Bạn có chắc chắn muốn ' + (newStatus === 'confirmed' ? 'duyệt' : 'từ chối') + ' đơn này?')) return;
    
    apiFetch(API + '/api/bookings/' + id, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    }).then(function(json) {
      if (json.success) {
        alert('Cập nhật trạng thái thành công!');
        window.syncAllData(); // Tải lại dữ liệu
      } else {
        alert('Lỗi: ' + json.message);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    loadPublicStats();
    if (getToken()) {
      window.syncAllData();
      
      // Khôi phục view cuối cùng người dùng đã truy cập
      const savedView = localStorage.getItem('biz_active_view');
      if (savedView && VIEWS[savedView]) {
        // Delay nhẹ để đảm bảo các module khác đã kịp init (ví dụ: serviceManagement)
        setTimeout(() => showView(savedView), 100);
      } else {
        showView('home');
      }
    }
  });

  window.showView = showView;
  window.navigateToView = showView;

})();
