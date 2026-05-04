/**
 * bookingManagement.js
 * Advanced Order/Booking management module for WanderViệt Business.
 */

(function() {
    'use strict';

    let currentFilterStatus = 'all';

    // Premium Styles
    const style = document.createElement('style');
    style.textContent = `
        .bk-mgmt-container { max-width: 1300px; margin: 0 auto; }
        .bk-mgmt-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; gap: 20px; flex-wrap: wrap; }
        .bk-mgmt-title h2 { font-size: 24px; font-weight: 800; color: #1a1a2e; }
        
        .bk-top-actions { display: flex; gap: 12px; margin-bottom: 16px; }
        .btn-export { background: #fff; color: #1a1a2e; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .btn-export:hover { background: #f8fafc; border-color: #cbd5e1; }

        .bk-search { position: relative; width: 320px; }
        .bk-search input { width: 100%; padding: 12px 16px 12px 44px; border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; font-size: 14px; outline: none; transition: all 0.2s; }
        .bk-search .icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; }

        .bk-filter-tabs { display: flex; gap: 8px; margin-bottom: 24px; background: #fff; padding: 6px; border-radius: 16px; border: 1px solid #f1f5f9; width: fit-content; }
        .bk-tab { padding: 8px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; transition: all 0.2s; }
        .bk-tab.active { background: #764ba2; color: #fff; box-shadow: 0 4px 12px rgba(118, 75, 162, 0.2); }

        .bk-table-card { background: #fff; border-radius: 24px; border: 1px solid #f1f5f9; box-shadow: 0 4px 20px rgba(0,0,0,0.02); overflow: hidden; }
        table.bk-table { width: 100%; border-collapse: collapse; text-align: left; }
        .bk-table th { background: #f8fafc; padding: 18px 24px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        
        .bk-table tr { transition: all 0.2s; animation: bkFadeIn 0.4s ease-out forwards; opacity: 0; transform: translateY(10px); }
        @keyframes bkFadeIn { to { opacity: 1; transform: translateY(0); } }
        .bk-table tr:hover { background: #fcfbff; }

        .bk-status { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
        .bk-status-pending { background: #fef9c3; color: #a16207; }
        .bk-status-confirmed { background: #e0f2fe; color: #0369a1; }
        .bk-status-completed { background: #dcfce7; color: #15803d; }
        .bk-status-cancelled { background: #fee2e2; color: #b91c1c; }

        .pay-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 800; margin-left: 4px; }
        .pay-paid { background: #dcfce7; color: #15803d; }
        .pay-unpaid { background: #fef2f2; color: #b91c1c; }

        .bk-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 2000; }
        .bk-modal-overlay.active { display: flex; }
        .bk-modal-card { background: #fff; border-radius: 24px; width: 100%; max-width: 550px; padding: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); }
        
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #f1f5f9; }
        .detail-label { color: #64748b; font-size: 13px; font-weight: 600; }
        .detail-value { color: #1a1a2e; font-size: 14px; font-weight: 700; text-align: right; }

        .notify-bar { background: #f3f0ff; border: 1px solid #e8e2ff; border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; margin-top: 24px; }
        .btn-notify { background: #764ba2; color: #fff; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
    `;
    document.head.appendChild(style);

    window.initBookingManagement = function() {
        const container = document.getElementById('booking-mgmt-container');
        if (!container) return;

        container.innerHTML = `
            <div class="bk-mgmt-container">
                <div class="bk-mgmt-header">
                    <div class="bk-mgmt-title">
                        <h2>Quản lý đơn hàng</h2>
                        <p>Theo dõi và xử lý các đơn đặt dịch vụ từ khách hàng</p>
                    </div>
                    <div class="bk-top-actions">
                        <button class="btn-export" onclick="window.exportToExcel()">📊 Xuất Excel</button>
                        <button class="btn-export" onclick="window.printToPDF()">📄 In PDF</button>
                        <div class="bk-search">
                            <span class="icon">🔍</span>
                            <input type="text" id="bk-search-input" placeholder="Tìm theo tên khách, mã đơn...">
                        </div>
                    </div>
                </div>

                <div class="bk-filter-tabs">
                    <div class="bk-tab active" data-status="all">Tất cả</div>
                    <div class="bk-tab" data-status="pending">Chờ xử lý</div>
                    <div class="bk-tab" data-status="confirmed">Đã xác nhận</div>
                    <div class="bk-tab" data-status="completed">Đã hoàn thành</div>
                    <div class="bk-tab" data-status="cancelled">Đã hủy</div>
                </div>

                <div class="bk-table-card">
                    <table class="bk-table">
                        <thead>
                            <tr>
                                <th>MÃ ĐƠN</th>
                                <th>KHÁCH HÀNG</th>
                                <th>THANH TOÁN</th>
                                <th>NGÀY ĐẶT</th>
                                <th>SỐ TIỀN</th>
                                <th>TRẠNG THÁI</th>
                                <th style="text-align: right;">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody id="bk-tbody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Detail Modal -->
            <div id="booking-detail-modal" class="bk-modal-overlay">
                <div class="bk-modal-card">
                    <div class="bk-modal-head">
                        <div class="bk-modal-title">Chi tiết đơn hàng & Thanh toán</div>
                        <div class="bk-modal-close" onclick="window.closeBookingDetail()">×</div>
                    </div>
                    <div id="booking-detail-content"></div>
                </div>
            </div>
        `;

        const bookings = typeof getBookings === 'function' ? getBookings() : [];
        renderBookingTable(bookings);

        // Filter Logic
        const searchInput = document.getElementById('bk-search-input');
        const tabs = document.querySelectorAll('.bk-tab');

        const applyFilters = () => {
            const query = (searchInput ? searchInput.value : '').toLowerCase();
            const filtered = bookings.filter(b => {
                const matchesSearch = b.customerName.toLowerCase().includes(query) || b.id.toLowerCase().includes(query);
                const matchesStatus = currentFilterStatus === 'all' || b.status === currentFilterStatus;
                return matchesSearch && matchesStatus;
            });
            renderBookingTable(filtered);
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilterStatus = tab.dataset.status;
                applyFilters();
            });
        });

        if (searchInput) searchInput.addEventListener('input', applyFilters);
    };

    window.openBookingDetail = function(id) {
        const bookings = typeof getBookings === 'function' ? getBookings() : [];
        const b = bookings.find(item => item.id === id);
        if (!b) return;

        const fmt = new Intl.NumberFormat('vi-VN');
        const statusText = { 'pending': 'Chờ xử lý', 'confirmed': 'Đã xác nhận', 'completed': 'Đã hoàn thành', 'cancelled': 'Đã hủy' };

        const content = document.getElementById('booking-detail-content');
        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 11px; color: #94a3b8; font-weight: 700;">MÃ ĐƠN HÀNG</div>
                <div style="font-size: 20px; font-weight: 800; color: #764ba2;">#${b.id}</div>
            </div>
            
            <div class="detail-row"><div class="detail-label">Khách hàng</div><div class="detail-value">${b.customerName}</div></div>
            <div class="detail-row"><div class="detail-label">Số điện thoại</div><div class="detail-value">${b.phone || '—'}</div></div>
            <div class="detail-row"><div class="detail-label">Dịch vụ</div><div class="detail-value">${b.serviceName}</div></div>
            <div class="detail-row"><div class="detail-label">Phương thức thanh toán</div><div class="detail-value">💳 Thẻ quốc tế (Visa/Master)</div></div>
            <div class="detail-row"><div class="detail-label">Trạng thái thanh toán</div><div class="detail-value"><span class="pay-badge pay-paid">ĐÃ THANH TOÁN ONLINE</span></div></div>
            <div class="detail-row"><div class="detail-label">Tổng tiền</div><div class="detail-value" style="font-size:18px; color:#1a1a2e;">${fmt.format(b.amount)} đ</div></div>

            <div class="notify-bar">
                <div style="font-size: 18px;">🔔</div>
                <div style="flex:1;">
                    <div style="font-size:12px; font-weight:700; color:#764ba2;">Thông báo cho khách hàng</div>
                    <div style="font-size:11px; color:#64748b;">Gửi cập nhật trạng thái đơn qua Email & SMS</div>
                </div>
                <button class="btn-notify" onclick="window.simulateSendNotify('${b.customerName}')">Gửi ngay</button>
            </div>

            <div style="margin-top:24px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                ${b.status === 'pending' ? `<button class="btn-create" onclick="window.updateBookingStatus('${b.id}', 'confirmed')">Xác nhận đơn</button>` : ''}
                ${b.status === 'confirmed' ? `<button class="btn-create" style="background:#22c55e;" onclick="window.updateBookingStatus('${b.id}', 'completed')">Hoàn thành</button>` : ''}
                <button class="btn-create" style="background:#f59e0b; border:none; color:#fff;" onclick="window.closeBookingDetail(); if(window.loadPaymentForBooking) window.loadPaymentForBooking('${b.id}');">Thanh toán</button>
                <button class="btn-cancel" onclick="window.closeBookingDetail()">Đóng</button>
            </div>
        `;
        document.getElementById('booking-detail-modal').classList.add('active');
    };

    window.simulateSendNotify = function(name) {
        alert(`🔔 Đã gửi thông báo thành công cho khách hàng ${name} qua Email và SMS!`);
    };

    window.exportToExcel = function() {
        const bookings = typeof getBookings === 'function' ? getBookings() : [];
        let csv = 'Ma Don,Khach Hang,Dich Vu,Ngay,So Tien,Trang Thai\n';
        bookings.forEach(b => {
            csv += `${b.id},${b.customerName},${b.serviceName},${b.date},${b.amount},${b.status}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'danh_sach_don_hang.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.printToPDF = function() { window.print(); };

    window.updateBookingStatus = function(id, newStatus) {
        const bookings = typeof getBookings === 'function' ? getBookings() : [];
        const b = bookings.find(item => item.id === id);
        if (b) {
            b.status = newStatus;
            renderBookingTable(bookings);
            window.openBookingDetail(id);
        }
    };

    window.closeBookingDetail = function() { document.getElementById('booking-detail-modal').classList.remove('active'); };

    function renderBookingTable(list) {
        const tbody = document.getElementById('bk-tbody');
        if (!tbody) return;
        const fmt = new Intl.NumberFormat('vi-VN');
        const statusText = { 'pending': 'Chờ xử lý', 'confirmed': 'Đã xác nhận', 'completed': 'Đã hoàn thành', 'cancelled': 'Đã hủy' };

        tbody.innerHTML = list.length === 0 ? '<tr><td colspan="7" style="text-align: center; padding: 100px; color: #94a3b8;">Không có dữ liệu.</td></tr>' : 
            list.map((b, idx) => `
                <tr style="animation-delay: ${idx * 0.05}s">
                    <td style="font-weight: 800; color: #764ba2;">#${b.id}</td>
                    <td><div class="cust-info"><div class="cust-avatar">${b.customerName.charAt(0)}</div><div style="font-weight: 700;">${b.customerName}</div></div></td>
                    <td><div style="font-size:12px;">💳 Online <span class="pay-badge pay-paid">PAID</span></div></td>
                    <td>${b.date}</td>
                    <td style="font-weight: 800;">${fmt.format(b.amount)} đ</td>
                    <td><span class="bk-status bk-status-${b.status}">${statusText[b.status]}</span></td>
                    <td style="text-align: right;"><button class="btn-view-detail" onclick="window.openBookingDetail('${b.id}')">Xem</button></td>
                </tr>
            `).join('');
    }

})();
