/**
 * userAnalytics.js — Toàn diện: Hoạt động người dùng & Hiệu suất kinh doanh
 */
(function () {
    'use strict';

    const commonCSS = `
        .ana-section { padding: 24px; font-family: 'Be Vietnam Pro', sans-serif; background: #f8fafc; }
        .ana-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .ana-card { background: #fff; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .ana-card-label { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
        .ana-card-val { font-size: 26px; font-weight: 900; color: #0f172a; }
        .ana-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .ana-chart-box { background: #fff; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; margin-bottom: 24px; }
        .ana-chart-title { font-size: 16px; font-weight: 800; margin-bottom: 20px; color: #0f172a; }
        @media (max-width: 900px) { .ana-row { grid-template-columns: 1fr; } }
    `;

    function getAuthHeader() {
        return { 'x-auth-token': localStorage.getItem('biz_auth_token') || localStorage.getItem('wander_token') };
    }

    // ── Part 1: Hoạt động người dùng ─────────────────────────────
    window.initUserActivity = function () {
        const container = document.getElementById('user-activity-view');
        if (!container) return;

        if (!document.getElementById('ana-common-style')) {
            const st = document.createElement('style');
            st.id = 'ana-common-style';
            st.textContent = commonCSS;
            document.head.appendChild(st);
        }

        container.innerHTML = `
            <div class="ana-section">
                <h2 style="margin-bottom:20px; font-weight:900">👥 Hoạt động người dùng</h2>
                <div class="ana-grid">
                    <div class="ana-card"><div class="ana-card-label">Tổng người dùng</div><div class="ana-card-val" id="ana-total-users">...</div></div>
                    <div class="ana-card"><div class="ana-card-label">Hoạt động tháng (MAU)</div><div class="ana-card-val" id="ana-mau">...</div></div>
                    <div class="ana-card"><div class="ana-card-label">Hoạt động ngày (DAU)</div><div class="ana-card-val" id="ana-dau">...</div></div>
                    <div class="ana-card"><div class="ana-card-label">Tỷ lệ gắn bó</div><div class="ana-card-val" id="ana-stickiness">...</div></div>
                </div>
                <div class="ana-row">
                    <div class="ana-chart-box"><div class="ana-chart-title">📈 Xu hướng người dùng mới (7 ngày)</div><div style="height:250px"><canvas id="userTrendChart"></canvas></div></div>
                    <div class="ana-chart-box"><div class="ana-chart-title">📱 Thiết bị sử dụng</div><div style="height:250px"><canvas id="userDeviceChart"></canvas></div></div>
                </div>
                <div class="ana-chart-box">
                    <div class="ana-chart-title">🔍 Từ khóa tìm kiếm phổ biến</div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap" id="ana-keywords">
                        <span style="background:#f1f5f9; padding:8px 16px; border-radius:10px; font-size:13px; color:#94a3b8">Đang tải...</span>
                    </div>
                </div>
            </div>
        `;

        fetch('http://localhost:5000/api/dashboard/user-analytics', { headers: getAuthHeader() })
        .then(r => r.json())
        .then(json => {
            if (json.success && json.data) {
                const d = json.data;
                document.getElementById('ana-total-users').textContent = d.totalUsers;
                document.getElementById('ana-mau').textContent = d.mau;
                document.getElementById('ana-dau').textContent = d.dau;
                document.getElementById('ana-stickiness').textContent = d.stickiness + '%';
                
                const ctxTrend = document.getElementById('userTrendChart');
                if (ctxTrend) {
                    new Chart(ctxTrend, {
                        type: 'line',
                        data: { 
                            labels: d.trend.labels, 
                            datasets: [{ 
                                label: 'Người dùng mới', 
                                data: d.trend.data, 
                                borderColor: '#6366f1', 
                                tension: 0.4, 
                                fill: true, 
                                backgroundColor: 'rgba(99,102,241,0.05)' 
                            }] 
                        },
                        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                    });
                }

                // Render real keywords
                const kwEl = document.getElementById('ana-keywords');
                if (kwEl && d.keywords && d.keywords.length > 0) {
                    kwEl.innerHTML = d.keywords.map(k => `<span style="background:#f1f5f9; padding:8px 16px; border-radius:10px; font-weight:700; font-size:14px; color:#6366f1">#${k}</span>`).join('');
                } else if (kwEl) {
                    kwEl.innerHTML = '<span style="background:#f1f5f9; padding:8px 16px; border-radius:10px; font-size:13px; color:#94a3b8">Chưa có đủ dữ liệu từ khóa.</span>';
                }
                
                const ctxDev = document.getElementById('userDeviceChart');
                if (ctxDev) {
                    new Chart(ctxDev, {
                        type: 'doughnut',
                        data: { labels: ['Mobile', 'Desktop', 'Tablet'], datasets: [{ data: [70, 25, 5], backgroundColor: ['#6366f1', '#f59e0b', '#94a3b8'] }] },
                        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
                    });
                }
            }
        });
    };

    // ── Part 2: Hiệu suất kinh doanh ─────────────────────────────
    window.initBusinessPerformance = function () {
        const container = document.getElementById('business-performance-view');
        if (!container) return;

        container.innerHTML = `
            <div class="ana-section">
                <h2 style="margin-bottom:20px; font-weight:900">📊 Hiệu suất kinh doanh</h2>
                <div class="ana-grid">
                    <div class="ana-card"><div class="ana-card-label">Tỷ lệ chuyển đổi</div><div class="ana-card-val" id="perf-conv-rate" style="color:#10b981">...</div></div>
                    <div class="ana-card"><div class="ana-card-label">Tổng lượt xem</div><div class="ana-card-val" id="perf-total-views">...</div></div>
                    <div class="ana-card"><div class="ana-card-label">Doanh thu mục tiêu</div><div class="ana-card-val">85%</div></div>
                    <div class="ana-card"><div class="ana-card-label">ROI chiến dịch</div><div class="ana-card-val" style="color:#6366f1">3.2x</div></div>
                </div>
                <div class="ana-chart-box">
                    <div class="ana-chart-title">💰 Doanh thu theo tuần (Triệu VNĐ)</div>
                    <div style="height:300px"><canvas id="perfRevenueChart"></canvas></div>
                </div>
            </div>
        `;

        fetch('http://localhost:5000/api/dashboard/user-analytics', { headers: getAuthHeader() })
        .then(r => r.json())
        .then(json => {
            if (json.success && json.data) {
                const d = json.data;
                const p = d.performance;
                
                document.getElementById('perf-conv-rate').textContent = p.conversionRate + '%';
                document.getElementById('perf-total-views').textContent = p.totalViews;
                
                const ctxPerf = document.getElementById('perfRevenueChart');
                if (ctxPerf) {
                    new Chart(ctxPerf, {
                        type: 'bar',
                        data: { 
                            labels: d.trend.labels, 
                            datasets: [{ 
                                label: 'Doanh thu (Triệu)', 
                                data: p.revenueTrend, 
                                backgroundColor: '#10b981', 
                                borderRadius: 8 
                            }] 
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }
            }
        });
    };

})();
