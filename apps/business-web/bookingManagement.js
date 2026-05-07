/**
 * bookingManagement.js — Real Data Edition
 * Fetch đơn hàng thật từ API /api/bookings (role: business)
 * Hỗ trợ: lọc tab, tìm kiếm, cập nhật trạng thái, xuất CSV.
 */
(function () {
    'use strict';

    // ── Helpers ───────────────────────────────────────────────────
    function getToken() {
        return localStorage.getItem('biz_auth_token') ||
               sessionStorage.getItem('biz_auth_token') ||
               localStorage.getItem('wander_business_token') ||
               sessionStorage.getItem('wander_business_token') ||
               localStorage.getItem('biz_token') ||
               sessionStorage.getItem('biz_token') ||
               localStorage.getItem('wander_token') || '';
    }

    async function apiFetch(url, opts) {
        // 1. Thử dùng window.api (Port 5000)
        if (window.api && typeof window.api.get === 'function') {
            try {
                const method = (opts?.method || 'GET').toLowerCase();
                const config = { headers: opts?.headers };
                
                if (method === 'get') return await window.api.get(url, config);
                if (method === 'put') return await window.api.put(url, JSON.parse(opts.body || '{}'), config);
                if (method === 'post') return await window.api.post(url, JSON.parse(opts.body || '{}'), config);
            } catch (err) {
                console.warn('[apiFetch] Port 5000 unreachable, falling back to local...', err.message);
                // Nếu lỗi kết nối, tiếp tục thực hiện fallback bên dưới
            }
        }

        // 2. Fallback dùng fetch (Port 3000/3002) trỏ về cùng origin
        opts = opts || {};
        const token = getToken();
        opts.headers = Object.assign({
            'Authorization': 'Bearer ' + token,
            'x-auth-token': token,
            'Content-Type': 'application/json'
        }, opts.headers || {});
        
        return fetch(url, opts).then(r => {
            if (r.status === 401) {
                console.warn('[apiFetch] 401 Unauthorized trên port local');
            }
            return r.json();
        });
    }

    function fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function fmtMoney(n) {
        return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
    }

    const STATUS_TEXT = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', completed: 'Đã hoàn thành', cancelled: 'Đã hủy' };
    const STATUS_CLASS = { pending: 'bk-status-pending', confirmed: 'bk-status-confirmed', completed: 'bk-status-completed', cancelled: 'bk-status-cancelled' };

    // ── State ─────────────────────────────────────────────────────
    let _allBookings = [];
    let _filterStatus = 'all';
    let _searchQuery = '';

    // ── Styles ────────────────────────────────────────────────────
    if (!document.getElementById('bk-mgmt-style')) {
        const st = document.createElement('style');
        st.id = 'bk-mgmt-style';
        st.textContent = `
        .bk-mgmt-container { max-width: 1300px; margin: 0 auto; }
        .bk-mgmt-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; gap: 20px; flex-wrap: wrap; }
        .bk-mgmt-title h2 { font-size: 24px; font-weight: 800; color: #1a1a2e; }
        .bk-mgmt-title p { font-size: 13px; color: #94a3b8; margin-top: 4px; }
        .bk-top-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .btn-export { background: #fff; color: #1a1a2e; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .btn-export:hover { background: #f8fafc; border-color: #cbd5e1; }
        .btn-refresh { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; border: none; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .btn-refresh:hover { opacity: 0.9; transform: translateY(-1px); }
        .bk-search { position: relative; }
        .bk-search input { width: 280px; padding: 10px 14px 10px 40px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; font-size: 13px; outline: none; }
        .bk-search .icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px; }
        .bk-stats-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
        .bk-stat-chip { background: #fff; border: 1px solid #f1f5f9; border-radius: 16px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; }
        .bk-stat-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .bk-stat-val { font-size: 20px; font-weight: 800; color: #1a1a2e; }
        .bk-stat-lbl { font-size: 11px; color: #94a3b8; font-weight: 600; }
        .bk-filter-tabs { display: flex; gap: 8px; margin-bottom: 20px; background: #fff; padding: 6px; border-radius: 14px; border: 1px solid #f1f5f9; width: fit-content; }
        .bk-tab { padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; transition: all 0.2s; }
        .bk-tab.active { background: #764ba2; color: #fff; box-shadow: 0 4px 12px rgba(118,75,162,0.2); }
        .bk-table-card { background: #fff; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 20px rgba(0,0,0,0.02); overflow: hidden; }
        table.bk-table { width: 100%; border-collapse: collapse; text-align: left; }
        .bk-table th { background: #f8fafc; padding: 14px 20px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .bk-table td { padding: 14px 20px; border-bottom: 1px solid #f8fafc; font-size: 13px; }
        .bk-table tr:last-child td { border-bottom: none; }
        .bk-table tr:hover td { background: #fcfbff; }
        .bk-status { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; }
        .bk-status-pending { background: #fef9c3; color: #a16207; }
        .bk-status-confirmed { background: #e0f2fe; color: #0369a1; }
        .bk-status-completed { background: #dcfce7; color: #15803d; }
        .bk-status-cancelled { background: #fee2e2; color: #b91c1c; }
        .cust-info { display: flex; align-items: center; gap: 10px; }
        .cust-av { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
        .btn-view-detail { background: #f5f3ff; color: #764ba2; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-view-detail:hover { background: #764ba2; color: #fff; }
        .bk-loading { text-align: center; padding: 80px; color: #94a3b8; }
        .bk-empty { text-align: center; padding: 80px; color: #94a3b8; }
        /* Modal */
        .bk-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 9000; }
        .bk-modal-overlay.active { display: flex; }
        .bk-modal-card { background: #fff; border-radius: 24px; width: 100%; max-width: 560px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); max-height: 90vh; overflow-y: auto; }
        .bk-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .bk-modal-title { font-size: 18px; font-weight: 800; color: #1a1a2e; }
        .bk-modal-close { font-size: 22px; cursor: pointer; color: #94a3b8; line-height: 1; }
        .bk-modal-close:hover { color: #1a1a2e; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #f1f5f9; }
        .detail-label { color: #64748b; font-size: 13px; font-weight: 600; }
        .detail-value { color: #1a1a2e; font-size: 14px; font-weight: 700; text-align: right; }
        .bk-action-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
        .bk-btn-confirm { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; }
        .bk-btn-complete { background: #22c55e; color: #fff; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; }
        .bk-btn-cancel { background: #fef2f2; color: #b91c1c; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; }
        .bk-btn-close { background: #f1f5f9; color: #475569; border: none; padding: 12px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; }
        `;
        document.head.appendChild(st);
    }

    // ── Render Stats ─────────────────────────────────────────────
    function renderStats(bookings) {
        const total = bookings.length;
        const pending = bookings.filter(b => b.status === 'pending').length;
        const confirmed = bookings.filter(b => b.status === 'confirmed').length;
        const revenue = bookings
            .filter(b => b.status === 'confirmed' || b.status === 'completed')
            .reduce((s, b) => s + (b.totalPrice || 0), 0);

        return `
        <div class="bk-stats-row">
            <div class="bk-stat-chip">
                <div class="bk-stat-icon" style="background:#f0e9ff">📋</div>
                <div><div class="bk-stat-val">${total}</div><div class="bk-stat-lbl">Tổng đơn</div></div>
            </div>
            <div class="bk-stat-chip">
                <div class="bk-stat-icon" style="background:#fef9c3">⏳</div>
                <div><div class="bk-stat-val">${pending}</div><div class="bk-stat-lbl">Chờ xử lý</div></div>
            </div>
            <div class="bk-stat-chip">
                <div class="bk-stat-icon" style="background:#e0f2fe">✅</div>
                <div><div class="bk-stat-val">${confirmed}</div><div class="bk-stat-lbl">Đã xác nhận</div></div>
            </div>
            <div class="bk-stat-chip">
                <div class="bk-stat-icon" style="background:#dcfce7">💰</div>
                <div><div class="bk-stat-val" style="font-size:15px">${(revenue/1000000).toFixed(1)}M</div><div class="bk-stat-lbl">Doanh thu</div></div>
            </div>
        </div>`;
    }

    // ── Render Table ─────────────────────────────────────────────
    function renderTable(list) {
        const tbody = document.getElementById('bk-tbody');
        const statsEl = document.getElementById('bk-stats-row');
        if (!tbody) return;

        if (statsEl) statsEl.innerHTML = renderStats(_allBookings);

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="bk-empty">📭 Chưa có đơn hàng nào.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map((b, idx) => {
            const userName = b.customerName || b.user?.name || 'Khách hàng';
            const svcName  = b.placeName || b.serviceName || b.service?.name || '—';
            const ini = userName.charAt(0).toUpperCase();
            const bookingId = (b.bookingId || b._id || '').toString().slice(-6).toUpperCase();
            const paymentStatus = b.paymentStatus || (b.paymentMethod === 'contact' ? 'unpaid' : 'paid');
            const payBadge = paymentStatus === 'paid'
                ? '<span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px">PAID</span>'
                : '<span style="background:#fef2f2;color:#b91c1c;font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px">UNPAID</span>';

            return `<tr style="animation:bkFadeIn 0.3s ${idx*0.04}s both">
                <td style="font-weight:800;color:#764ba2">#${bookingId}</td>
                <td><div class="cust-info"><div class="cust-av">${ini}</div><div>
                    <div style="font-weight:700">${userName}</div>
                    <div style="font-size:11px;color:#94a3b8">${b.user?.email || ''}</div>
                </div></div></td>
                <td style="max-width:180px;font-weight:600">${svcName}</td>
                <td>${fmtDate(b.useDate || b.date || b.createdAt)}</td>
                <td style="font-weight:800">${fmtMoney(b.totalPrice)}</td>
                <td>${payBadge}</td>
                <td><span class="bk-status ${STATUS_CLASS[b.status] || ''}">${STATUS_TEXT[b.status] || b.status}</span></td>
                <td><button class="btn-view-detail" onclick="window.openBookingDetail('${b._id}')">Xem</button></td>
            </tr>`;
        }).join('');
    }

    // ── Filter & Search ──────────────────────────────────────────
    function applyFilters() {
        const q = _searchQuery.toLowerCase();
        const filtered = _allBookings.filter(b => {
            const name = (b.user?.name || b.customerName || '').toLowerCase();
            const svc  = (b.service?.name || b.serviceName || '').toLowerCase();
            const id   = (b.bookingId || b._id || '').toString().toLowerCase();
            const matchSearch = !q || name.includes(q) || svc.includes(q) || id.includes(q);
            const matchStatus = _filterStatus === 'all' || b.status === _filterStatus;
            return matchSearch && matchStatus;
        });
        renderTable(filtered);
    }

    // ── Load from API ────────────────────────────────────────────
    function loadBookings() {
        const tbody = document.getElementById('bk-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="bk-loading">⏳ Đang tải đơn hàng...</td></tr>';

        apiFetch('/api/bookings')
            .then(res => {
                // Axios (window.api) trả về payload trực tiếp nhờ interceptor: {success:true, data:[]}
                // Fetch trả về cùng cấu trúc sau r.json()
                if (res && res.success) {
                    _allBookings = res.data || [];
                    applyFilters();
                } else {
                    throw new Error(res?.message || 'Lỗi API (Không rõ nguyên nhân)');
                }
            })
            .catch(err => {
                console.error('Load bookings failed:', err);
                if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="bk-empty" style="color:#ef4444">❌ Lỗi kết nối: ${err.message || 'Không thể liên lạc với máy chủ'}</td></tr>`;
            });
    }

    // ── Init ─────────────────────────────────────────────────────
    window.initBookingManagement = function () {
        const container = document.getElementById('booking-mgmt-container');
        if (!container) return;
        _filterStatus = 'all';
        _searchQuery = '';

        container.innerHTML = `
        <div class="bk-mgmt-container">
            <div class="bk-mgmt-header">
                <div class="bk-mgmt-title">
                    <h2>📋 Quản lý đơn hàng</h2>
                    <p>Đơn hàng thực tế từ khách đặt trên hệ thống WanderViệt</p>
                </div>
                <div class="bk-top-actions">
                    <button class="btn-refresh" onclick="window._bkLoadBookings()">🔄 Làm mới</button>
                    <button class="btn-export" onclick="window._bkExportCSV()">📊 Xuất CSV</button>
                    <div class="bk-search">
                        <span class="icon">🔍</span>
                        <input type="text" id="bk-search-input" placeholder="Tên khách, dịch vụ, mã đơn...">
                    </div>
                </div>
            </div>

            <div id="bk-stats-row"></div>

            <div class="bk-filter-tabs">
                <div class="bk-tab active" data-status="all">Tất cả</div>
                <div class="bk-tab" data-status="pending">⏳ Chờ xử lý</div>
                <div class="bk-tab" data-status="confirmed">✅ Đã xác nhận</div>
                <div class="bk-tab" data-status="completed">🏁 Hoàn thành</div>
                <div class="bk-tab" data-status="cancelled">❌ Đã hủy</div>
            </div>

            <div class="bk-table-card">
                <table class="bk-table">
                    <thead><tr>
                        <th>MÃ ĐƠN</th>
                        <th>KHÁCH HÀNG</th>
                        <th>DỊCH VỤ</th>
                        <th>NGÀY ĐẶT</th>
                        <th>TỔNG TIỀN</th>
                        <th>THANH TOÁN</th>
                        <th>TRẠNG THÁI</th>
                        <th>THAO TÁC</th>
                    </tr></thead>
                    <tbody id="bk-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- Detail Modal -->
        <div id="booking-detail-modal" class="bk-modal-overlay">
            <div class="bk-modal-card">
                <div class="bk-modal-head">
                    <div class="bk-modal-title">Chi tiết đơn hàng</div>
                    <div class="bk-modal-close" onclick="window.closeBookingDetail()">×</div>
                </div>
                <div id="booking-detail-content"></div>
            </div>
        </div>`;

        // Tab click
        container.querySelectorAll('.bk-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.bk-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                _filterStatus = tab.dataset.status;
                applyFilters();
            });
        });

        // Search
        const si = document.getElementById('bk-search-input');
        if (si) si.addEventListener('input', e => { _searchQuery = e.target.value; applyFilters(); });

        loadBookings();
    };

    // ── Global helpers ───────────────────────────────────────────
    window._bkLoadBookings = loadBookings;

    window._bkExportCSV = function() {
        if (!_allBookings.length) { alert('Chưa có dữ liệu để xuất.'); return; }
        let csv = 'Mã đơn,Khách hàng,Dịch vụ,Ngày đặt,Tổng tiền,Trạng thái\n';
        _allBookings.forEach(b => {
            const id  = (b.bookingId || b._id || '').toString().slice(-6).toUpperCase();
            const usr = b.user?.name || b.customerName || '';
            const svc = b.service?.name || b.serviceName || '';
            const dt  = fmtDate(b.date || b.createdAt);
            csv += `#${id},"${usr}","${svc}",${dt},${b.totalPrice || 0},${STATUS_TEXT[b.status] || b.status}\n`;
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'don-hang-' + new Date().toISOString().slice(0,10) + '.csv' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.openBookingDetail = function(id) {
        const b = _allBookings.find(x => x._id === id);
        if (!b) return;

        const userName = b.customerName || b.user?.name || 'Khách hàng';
        const userEmail = b.customerEmail || b.user?.email || '—';
        const svcName = b.placeName || b.serviceName || b.service?.name || '—';
        const svcLoc  = b.service?.location || '—';
        const bookingId = (b.bookingId || b._id || '').toString().slice(-6).toUpperCase();

        const content = document.getElementById('booking-detail-content');
        if (!content) return;

        content.innerHTML = `
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:4px">MÃ ĐƠN HÀNG</div>
                <div style="font-size:22px;font-weight:900;color:#764ba2">#${bookingId}</div>
                <span class="bk-status ${STATUS_CLASS[b.status] || ''}" style="margin-top:8px;display:inline-block">${STATUS_TEXT[b.status] || b.status}</span>
            </div>
            <div class="detail-row"><span class="detail-label">Khách hàng</span><span class="detail-value">${userName}</span></div>
            <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${userEmail}</span></div>
            <div class="detail-row"><span class="detail-label">Dịch vụ</span><span class="detail-value">${svcName}</span></div>
            <div class="detail-row"><span class="detail-label">Địa điểm</span><span class="detail-value">${svcLoc}</span></div>
            <div class="detail-row"><span class="detail-label">Ngày đặt</span><span class="detail-value">${fmtDate(b.useDate || b.date || b.createdAt)}</span></div>
            <div class="detail-row"><span class="detail-label">Thanh toán</span><span class="detail-value">${b.paymentMethod || 'Online'}</span></div>
            <div class="detail-row"><span class="detail-label">Tổng tiền</span><span class="detail-value" style="font-size:18px;color:#764ba2">${fmtMoney(b.totalPrice)}</span></div>

            <div id="bk-detail-action-area">
                ${renderActionButtons(b)}
            </div>`;

        document.getElementById('booking-detail-modal').classList.add('active');
    };

    function renderActionButtons(b) {
        const id = b._id;
        let btns = '';
        if (b.status === 'pending')   btns += `<button class="bk-btn-confirm" onclick="window.updateBookingStatus('${id}','confirmed')">✅ Xác nhận đơn</button>`;
        if (b.status === 'confirmed') btns += `<button class="bk-btn-complete" onclick="window.updateBookingStatus('${id}','completed')">🏁 Đánh dấu hoàn thành</button>`;
        if (b.status !== 'cancelled' && b.status !== 'completed')
            btns += `<button class="bk-btn-cancel" onclick="window.updateBookingStatus('${id}','cancelled')">❌ Hủy đơn</button>`;
        btns += `<button class="bk-btn-close" onclick="window.closeBookingDetail()">Đóng</button>`;
        return `<div class="bk-action-btns">${btns}</div>`;
    }

    window.updateBookingStatus = function(id, newStatus) {
        if (!confirm('Xác nhận thay đổi trạng thái đơn này?')) return;
        apiFetch('/api/bookings/' + id, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        }).then(json => {
            if (json.success) {
                // Update local state
                const b = _allBookings.find(x => x._id === id);
                if (b) b.status = newStatus;
                applyFilters();
                // Refresh modal
                const area = document.getElementById('bk-detail-action-area');
                if (area && b) area.innerHTML = renderActionButtons(b);
                const statusEl = document.querySelector('#booking-detail-modal .bk-status');
                if (statusEl && b) { statusEl.className = 'bk-status ' + (STATUS_CLASS[b.status]||''); statusEl.textContent = STATUS_TEXT[b.status]||b.status; }
                if (window.WanderUI?.showToast) window.WanderUI.showToast('Cập nhật trạng thái thành công!', 'success');
            } else {
                alert('Lỗi: ' + (json.message || 'Không thể cập nhật'));
            }
        }).catch(() => alert('Lỗi kết nối máy chủ.'));
    };

    window.closeBookingDetail = function() {
        const m = document.getElementById('booking-detail-modal');
        if (m) m.classList.remove('active');
    };

})();
