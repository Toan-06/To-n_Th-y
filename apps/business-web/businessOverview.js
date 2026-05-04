/**
 * businessOverview.js — Trang chủ Dashboard (Premium Edition)
 * Layout: Quick Actions | KPI Cards | Revenue Chart | [Activities & Messages] | [Featured Services & Reviews]
 */
(function () {
    'use strict';

    // ── Data Helpers ─────────────────────────────────────────────
    function getCurrentBiz() {
        var keys = ['biz_auth_user', 'currentUser'];
        for (var i = 0; i < keys.length; i++) {
            var raw = localStorage.getItem(keys[i]) || sessionStorage.getItem(keys[i]);
            if (raw) { try { return JSON.parse(raw); } catch (e) { } }
        }
        return null;
    }

    function getServices() {
        const stored = JSON.parse(localStorage.getItem('biz_services') || '[]');
        if (stored.length > 0) return stored;
        return [
            { id: 1, name: 'Tour Hạ Long VIP 2N1Đ',    price: 2500000, bookings: 124, rating: 4.8, status: 'active',  image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80' },
            { id: 2, name: 'Khách sạn Mường Thanh',     price: 1800000, bookings: 87,  rating: 4.5, status: 'active',  image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80' },
            { id: 3, name: 'Nhà hàng Bếp Việt Hội An',  price: 350000,  bookings: 203, rating: 4.7, status: 'active',  image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
            { id: 4, name: 'Tour Sapa Trekking 3N2Đ',   price: 3200000, bookings: 45,  rating: 4.9, status: 'pending', image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80' },
        ];
    }

    const activities = [
        { icon: '📅', text: 'Nguyễn Văn A đã đặt Tour Hạ Long',     time: '2 phút trước' },
        { icon: '💬', text: 'Bạn có 2 tin nhắn mới',                 time: '15 phút trước' },
        { icon: '⭐', text: 'Có 3 đánh giá mới từ khách hàng',       time: '1 giờ trước' },
        { icon: '📅', text: 'Trần Thị B đã đặt Khách sạn Đà Nẵng',  time: '2 giờ trước' },
        { icon: '✅', text: 'Đơn hàng #1042 đã được xác nhận',       time: '3 giờ trước' },
    ];

    const messages = [
        { user: 'Nguyễn Văn A', av: 'N', color: '#6366f1', text: 'Cho mình hỏi giá tour Hạ Long 2 người?', time: '5p', unread: true },
        { user: 'Trần Thị B',   av: 'T', color: '#ec4899', text: 'Còn phòng không ạ?', time: '30p', unread: true },
        { user: 'Lê Minh C',    av: 'L', color: '#f59e0b', text: 'Tour có bao gồm bữa ăn không?', time: '2h', unread: false },
    ];

    const reviews = [
        { user: 'Hoàng Văn E', av: 'H', rating: 5, text: 'Tuyệt vời! Trải nghiệm khó quên.', svc: 'Tour Hạ Long', time: '1 ngày trước' },
        { user: 'Phạm Thu D',   av: 'P', rating: 4, text: 'Dịch vụ tốt, nhân viên thân thiện.', svc: 'Khách sạn Đà Nẵng', time: '2 ngày trước' },
    ];

    // ── Utils ────────────────────────────────────────────────────
    function formatMoney(n) { return new Intl.NumberFormat('vi-VN').format(n) + ' đ'; }
    function stars(r) { return '<span style="color:#f59e0b">' + '★'.repeat(r) + '</span><span style="color:#e2e8f0">' + '★'.repeat(5-r) + '</span>'; }

    // ── CSS ──────────────────────────────────────────────────────
    const css = `
    .hp-wrap { padding: 24px; background: #f8fafc; font-family: 'Be Vietnam Pro', sans-serif; }
    
    /* Quick Actions */
    .hp-quick { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .hp-qbtn { padding: 10px 18px; border-radius: 12px; background: #fff; border: 1.5px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all .2s; }
    .hp-qbtn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; transform: translateY(-1px); }
    .hp-qbtn.primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; }
    .hp-qbtn.primary:hover { box-shadow: 0 4px 12px rgba(99,102,241,.3); opacity: 0.9; }

    /* KPI Cards */
    .hp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .hp-kpi { background: #fff; padding: 20px; border-radius: 16px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.02); }
    .hp-kpi-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .hp-kpi-val { font-size: 24px; font-weight: 900; color: #0f172a; line-height: 1.1; }
    .hp-kpi-lbl { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-top: 4px; }

    /* Chart Section */
    .hp-chart-card { background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #f1f5f9; margin-bottom: 24px; }
    .hp-chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .hp-chart-title { font-size: 16px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
    .hp-chart-container { height: 260px; position: relative; }

    /* Layout */
    .hp-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 24px; }
    .hp-card { background: #fff; border-radius: 20px; border: 1px solid #f1f5f9; overflow: hidden; display: flex; flex-direction: column; }
    .hp-card-head { padding: 20px 20px 0; display: flex; justify-content: space-between; align-items: center; }
    .hp-card-title { font-size: 15px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
    .hp-card-body { padding: 16px 20px 20px; }
    
    /* Lists */
    .hp-list-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f8fafc; }
    .hp-list-item:last-child { border-bottom: none; }
    .hp-list-av { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 14px; flex-shrink: 0; }
    .hp-list-text { font-size: 14px; font-weight: 600; color: #334155; line-height: 1.4; }
    .hp-list-sub  { font-size: 12px; color: #94a3b8; font-weight: 500; margin-top: 2px; }

    /* Service Grid (Horizontal) */
    .hp-svcs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .hp-svc { background: #f8fafc; padding: 12px; border-radius: 14px; border: 1px solid #f1f5f9; display: flex; gap: 12px; transition: all .2s; }
    .hp-svc:hover { border-color: #6366f1; background: #fff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.05); }
    .hp-svc-img { width: 64px; height: 56px; border-radius: 10px; object-fit: cover; }
    .hp-svc-info { flex: 1; min-width: 0; }
    .hp-svc-name { font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hp-svc-meta { font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 4px; }
    `;

    // ── Main Content HTML ────────────────────────────────────────
    function render() {
        const biz = getCurrentBiz();
        const svcs = getServices();
        const activeSvcs = svcs.filter(s => s.status === 'active').length;
        const totalBookings = svcs.reduce((s, x) => s + (x.bookings || 0), 0);

        return `
        <div class="hp-wrap">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
                <div>
                    <h1 style="font-size:24px;font-weight:900;color:#0f172a">Trang chủ</h1>
                    <p style="font-size:14px;color:#64748b;margin-top:4px">Chào mừng trở lại, ${biz ? biz.name : 'Đối tác'}! Đây là tổng quan hôm nay.</p>
                </div>
                <div style="background:#fff;padding:8px 16px;border-radius:12px;border:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#475569">
                    📅 ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="hp-quick">
                <button class="hp-qbtn primary" onclick="window.navigateToView('services')">➕ Đăng tour mới</button>
                <button class="hp-qbtn" onclick="window.navigateToView('bookings')">📑 Danh sách đơn</button>
                <button class="hp-qbtn" onclick="location.reload()">🔄 Làm mới dữ liệu</button>
                <button class="hp-qbtn" onclick="window.navigateToView('profile')">🏢 Xem hồ sơ DN</button>
            </div>

            <!-- KPI Cards -->
            <div class="hp-kpis">
                <div class="hp-kpi">
                    <div class="hp-kpi-icon" style="background:#fef3c7">💰</div>
                    <div><div class="hp-kpi-val" style="color:#d97706">4.2M đ</div><div class="hp-kpi-lbl">Doanh thu hôm nay</div></div>
                </div>
                <div class="hp-kpi">
                    <div class="hp-kpi-icon" style="background:#dcfce7">📈</div>
                    <div><div class="hp-kpi-val" style="color:#059669">12</div><div class="hp-kpi-lbl">Đơn hàng hôm nay</div></div>
                </div>
                <div class="hp-kpi">
                    <div class="hp-kpi-icon" style="background:#e0e7ff">💬</div>
                    <div><div class="hp-kpi-val" style="color:#4f46e5">2</div><div class="hp-kpi-lbl">Tin nhắn mới</div></div>
                </div>
                <div class="hp-kpi">
                    <div class="hp-kpi-icon" style="background:#f1f5f9">🏨</div>
                    <div><div class="hp-kpi-val" style="color:#475569">${activeSvcs}</div><div class="hp-kpi-lbl">Dịch vụ đang chạy</div></div>
                </div>
            </div>

            <!-- Revenue Chart -->
            <div class="hp-chart-card">
                <div class="hp-chart-head">
                    <div class="hp-chart-title">📊 Xu hướng doanh thu (7 ngày qua)</div>
                    <div style="font-size:12px;font-weight:700;color:#10b981">▲ +12.5% so với tuần trước</div>
                </div>
                <div class="hp-chart-container">
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>

            <!-- Main Row -->
            <div class="hp-row">
                <!-- Left: Activities & Featured Services -->
                <div style="display:flex;flex-direction:column;gap:20px">
                    <div class="hp-card">
                        <div class="hp-card-head">
                            <div class="hp-card-title">🕒 Hoạt động gần đây</div>
                            <span class="hp-card-link" onclick="window.navigateToView('bookings')">Xem tất cả →</span>
                        </div>
                        <div class="hp-card-body">
                            ${activities.map(a => `
                                <div class="hp-list-item">
                                    <div style="font-size:20px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border-radius:10px">${a.icon}</div>
                                    <div style="flex:1">
                                        <div class="hp-list-text">${a.text}</div>
                                        <div class="hp-list-sub">${a.time}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="hp-card">
                        <div class="hp-card-head">
                            <div class="hp-card-title">🌟 Dịch vụ nổi bật</div>
                            <span class="hp-card-link" onclick="window.navigateToView('services')">Quản lý →</span>
                        </div>
                        <div class="hp-card-body">
                            <div class="hp-svcs">
                                ${svcs.slice(0, 4).map(s => `
                                    <div class="hp-svc" onclick="window.navigateToView('services')">
                                        <img src="${s.image}" class="hp-svc-img">
                                        <div class="hp-svc-info">
                                            <div class="hp-svc-name">${s.name}</div>
                                            <div class="hp-svc-meta">⭐ ${s.rating} • ${s.bookings} lượt đặt</div>
                                            <div style="font-size:12px;font-weight:800;color:#10b981;margin-top:4px">${formatMoney(s.price)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Messages & Reviews -->
                <div style="display:flex;flex-direction:column;gap:20px">
                    <div class="hp-card">
                        <div class="hp-card-head">
                            <div class="hp-card-title">💬 Chăm sóc khách hàng</div>
                            <span class="hp-card-link" onclick="window.navigateToView('messages')">Phòng chat →</span>
                        </div>
                        <div class="hp-card-body">
                            ${messages.map(m => `
                                <div class="hp-list-item">
                                    <div class="hp-list-av" style="background:${m.color}">${m.av}</div>
                                    <div style="flex:1">
                                        <div style="display:flex;justify-content:space-between">
                                            <div class="hp-list-text">${m.user}</div>
                                            <div style="font-size:10px;color:#94a3b8">${m.time}</div>
                                        </div>
                                        <div class="hp-list-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;${m.unread ? 'font-weight:700;color:#1e293b' : ''}">${m.text}</div>
                                    </div>
                                    ${m.unread ? '<div style="width:8px;height:8px;border-radius:50%;background:#6366f1"></div>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="hp-card">
                        <div class="hp-card-head">
                            <div class="hp-card-title">⭐ Đánh giá mới nhất</div>
                            <span class="hp-card-link" onclick="window.navigateToView('reviews')">Tất cả →</span>
                        </div>
                        <div class="hp-card-body">
                            ${reviews.map(r => `
                                <div class="hp-list-item" style="flex-direction:column;align-items:flex-start;gap:4px">
                                    <div style="display:flex;justify-content:space-between;width:100%">
                                        <div style="font-size:13px;font-weight:700;color:#334155">${r.user}</div>
                                        <div style="font-size:11px;color:#94a3b8">${r.time}</div>
                                    </div>
                                    <div>${stars(r.rating)}</div>
                                    <div style="font-size:13px;color:#64748b;line-height:1.4;font-style:italic">"${r.text}"</div>
                                    <div style="font-size:11px;font-weight:700;color:#6366f1;background:#f5f3ff;padding:2px 8px;border-radius:4px;margin-top:4px">${r.svc}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    // ── Chart Logic ──────────────────────────────────────────────
    function initChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        
        // Gradient
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'],
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: [1200000, 2500000, 1800000, 4200000, 3100000, 5600000, 4800000],
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
            }
        });
    }

    // ── Update Sidebar/Topbar Names ──────────────────────────────
    function updateIdentity() {
        const biz = getCurrentBiz();
        if (!biz) return;
        
        const nameElems = [document.getElementById('sidebar-name'), document.getElementById('topbar-username')];
        nameElems.forEach(el => { if(el) el.textContent = biz.name; });
        
        const tierEl = document.getElementById('sidebar-tier');
        if (tierEl) tierEl.textContent = biz.tier || 'PARTNER';
        
        const avatarEl = document.getElementById('sidebar-avatar');
        if (avatarEl && biz.avatar) avatarEl.innerHTML = `<img src="${biz.avatar}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">`;
    }

    // ── Main Init ────────────────────────────────────────────────
    window.initOverview = function () {
        const container = document.getElementById('overview-container');
        if (!container) return;

        // CSS
        if (!document.getElementById('hp-style')) {
            const st = document.createElement('style');
            st.id = 'hp-style';
            st.textContent = css;
            document.head.appendChild(st);
        }

        container.innerHTML = render();
        updateIdentity();
        
        // Cần chờ DOM render xong để vẽ Chart
        setTimeout(initChart, 50);
    };

})();
