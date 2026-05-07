/**
 * paymentManagement.js
 * Payment management module for WanderViệt Business.
 */

(function() {
    'use strict';

    // Premium Styles for Payments
    const style = document.createElement('style');
    style.textContent = `
        .pay-mgmt-container {
            max-width: 1300px;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .pay-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 0.8s linear infinite;
            vertical-align: middle;
            margin-right: 8px;
            margin-top: -2px;
        }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

        .pay-success-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 3000; animation: fadeIn 0.3s;
        }

        .pay-success-modal {
            background: #fff; padding: 40px; border-radius: 24px;
            text-align: center; width: 100%; max-width: 420px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.15);
            animation: slideUp 0.3s ease-out;
        }

        .pay-success-icon { 
            font-size: 72px; 
            margin-bottom: 20px; 
            display: inline-block; 
            animation: bounceIcon 0.6s ease-out; 
        }

        .pay-mgmt-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }

        .pay-mgmt-title h2 {
            font-size: 24px;
            font-weight: 800;
            color: #1a1a2e;
        }

        .pay-mgmt-title p {
            font-size: 14px;
            color: #64748b;
            margin-top: 4px;
        }

        .pay-mgmt-body {
            background: #fff;
            border-radius: 28px;
            border: 1px solid #f1f5f9;
            box-shadow: 0 15px 50px rgba(0,0,0,0.06);
            min-height: 500px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 24px;
            padding: 60px;
        }

        .pay-icon-wrapper {
            font-size: 72px;
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            width: 140px;
            height: 140px;
            border-radius: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 30px rgba(34, 197, 94, 0.15);
            margin-bottom: 8px;
        }

        .pay-card {
            background: #fff;
            border-radius: 24px;
            border: 1px solid #f1f5f9;
            box-shadow: 0 20px 50px rgba(0,0,0,0.08);
            width: 100%;
            max-width: 600px;
            overflow: hidden;
        }

        .pay-card-header {
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            padding: 30px 40px;
            color: #fff;
            text-align: center;
        }

        .pay-card-header h3 {
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 8px;
        }

        .pay-card-header .pay-amount {
            font-size: 36px;
            font-weight: 900;
            letter-spacing: -1px;
        }

        .pay-card-body {
            padding: 40px;
        }

        .pay-detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px dashed #e2e8f0;
        }

        .pay-detail-row:last-child {
            border-bottom: none;
        }

        .pay-detail-label {
            color: #64748b;
            font-size: 14px;
            font-weight: 600;
        }

        .pay-detail-value {
            color: #1a1a2e;
            font-size: 16px;
            font-weight: 800;
            text-align: right;
            max-width: 60%;
        }

        .pay-actions {
            padding: 0 40px 40px 40px;
            display: flex;
            gap: 16px;
        }

        .btn-pay-confirm {
            flex: 1;
            background: #22c55e;
            color: #fff;
            border: none;
            padding: 16px;
            border-radius: 16px;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3);
        }

        .btn-pay-confirm:hover {
            background: #16a34a;
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(34, 197, 94, 0.4);
        }

        .btn-pay-cancel {
            background: #f1f5f9;
            color: #64748b;
            border: none;
            padding: 16px 32px;
            border-radius: 16px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-pay-cancel:hover {
            background: #e2e8f0;
            color: #1a1a2e;
        }

        /* Payment Methods */
        .pay-methods {
            padding: 20px 40px;
            background: #f8fafc;
            border-top: 1px solid #f1f5f9;
            border-bottom: 1px solid #f1f5f9;
        }

        .pay-method-title {
            font-size: 14px;
            font-weight: 800;
            color: #1a1a2e;
            margin-bottom: 16px;
            text-align: left;
        }

        .pay-method-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .pay-method-label {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            background: #fff;
            border: 1.5px solid #e2e8f0;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .pay-method-label:hover {
            border-color: #cbd5e1;
            background: #fcfcfd;
        }

        .pay-method-input {
            width: 20px;
            height: 20px;
            accent-color: #764ba2;
            cursor: pointer;
        }

        .pay-method-label:has(input:checked) {
            border-color: #764ba2;
            background: rgba(118, 75, 162, 0.03);
            box-shadow: 0 4px 12px rgba(118, 75, 162, 0.05);
        }

        .pay-method-info {
            display: flex;
            flex-direction: column;
            text-align: left;
        }

        .pay-method-name {
            font-size: 15px;
            font-weight: 700;
            color: #1a1a2e;
        }

        .pay-method-desc {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
        }

        .pay-method-icon {
            font-size: 24px;
            width: 40px;
            height: 40px;
            background: #f1f5f9;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);

    /**
     * Initialize Payment Management view (Empty state)
     */
    window.initPaymentManagement = function() {
        const container = document.getElementById('payment-mgmt-container');
        if (!container) return;

        container.innerHTML = `
            <div class="pay-mgmt-container">
                <div class="pay-mgmt-header">
                    <div class="pay-mgmt-title">
                        <h2>Thanh toán đơn hàng</h2>
                        <p>Kiểm tra và xử lý giao dịch thanh toán từ khách hàng</p>
                    </div>
                </div>

                <div class="pay-mgmt-body" style="text-align: center;">
                    <div class="pay-icon-wrapper">💳</div>
                    <h3 style="font-weight: 800; font-size: 24px; color: #1a1a2e;">Cổng thanh toán WanderViệt</h3>
                    <p style="color: #64748b; font-size: 15px; max-width: 400px; line-height: 1.6;">
                        Vui lòng chọn một đơn hàng từ trang Quản lý đơn hàng để tiến hành thanh toán.
                    </p>
                </div>
            </div>
        `;
    };

    /**
     * Load specific booking for payment
     */
    window.loadPaymentForBooking = function(bookingId) {
        if (window.navigateToView) {
            window.navigateToView('payments');
        }

        const container = document.getElementById('payment-mgmt-container');
        if (!container) return;

        const bookings = typeof getBookings === 'function' ? getBookings() : [];
        const b = bookings.find(item => item.id === bookingId);
        
        if (!b) {
            window.initPaymentManagement(); // Fallback to empty state
            return;
        }

        const fmt = new Intl.NumberFormat('vi-VN');

        container.innerHTML = `
            <div class="pay-mgmt-container">
                <div class="pay-mgmt-header">
                    <div class="pay-mgmt-title">
                        <h2>Thanh toán đơn hàng</h2>
                        <p>Xác nhận thanh toán cho đơn hàng #${b.id}</p>
                    </div>
                </div>

                <div style="display: flex; justify-content: center; width: 100%;">
                    <div class="pay-card">
                        <div class="pay-card-header">
                            <h3>Tổng thanh toán</h3>
                            <div class="pay-amount">${fmt.format(b.amount)} đ</div>
                        </div>
                        <div class="pay-card-body">
                            <div class="pay-detail-row">
                                <div class="pay-detail-label">Mã đơn hàng</div>
                                <div class="pay-detail-value" style="color: #764ba2;">#${b.id}</div>
                            </div>
                            <div class="pay-detail-row">
                                <div class="pay-detail-label">Khách hàng</div>
                                <div class="pay-detail-value">${b.customerName}</div>
                            </div>
                            <div class="pay-detail-row">
                                <div class="pay-detail-label">Dịch vụ</div>
                                <div class="pay-detail-value">${b.serviceName}</div>
                            </div>
                            <div class="pay-detail-row">
                                <div class="pay-detail-label">Ngày đặt</div>
                                <div class="pay-detail-value">${b.date}</div>
                            </div>
                            <div class="pay-detail-row">
                                <div class="pay-detail-label">Số người</div>
                                <div class="pay-detail-value">${b.guests || 1} người</div>
                            </div>
                        </div>

                        <div class="pay-methods">
                            <div class="pay-method-title">PHƯƠNG THỨC THANH TOÁN</div>
                            <div class="pay-method-options">
                                <label class="pay-method-label">
                                    <input type="radio" name="payment_method" value="cod" class="pay-method-input" checked>
                                    <div class="pay-method-icon">💵</div>
                                    <div class="pay-method-info">
                                        <span class="pay-method-name">Thanh toán khi đến (COD)</span>
                                        <span class="pay-method-desc">Thanh toán tiền mặt tại quầy lễ tân</span>
                                    </div>
                                </label>
                                
                                <label class="pay-method-label">
                                    <input type="radio" name="payment_method" value="bank" class="pay-method-input">
                                    <div class="pay-method-icon">🏦</div>
                                    <div class="pay-method-info">
                                        <span class="pay-method-name">Chuyển khoản ngân hàng</span>
                                        <span class="pay-method-desc">Xác nhận nhanh qua mã QR</span>
                                    </div>
                                </label>

                                <label class="pay-method-label">
                                    <input type="radio" name="payment_method" value="ewallet" class="pay-method-input">
                                    <div class="pay-method-icon">📱</div>
                                    <div class="pay-method-info">
                                        <span class="pay-method-name">Ví điện tử</span>
                                        <span class="pay-method-desc">Momo, ZaloPay, VNPay</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="pay-actions" style="padding-top: 40px;">
                            <button class="btn-pay-cancel" onclick="if(window.navigateToView) window.navigateToView('bookings');">Quay lại</button>
                            <button class="btn-pay-confirm" onclick="window.confirmPayment('${b.id}')">Xác nhận thanh toán</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    window.confirmPayment = function(bookingId) {
        const btn = document.querySelector('.btn-pay-confirm');
        if (!btn) return;

        // Set Loading State
        btn.disabled = true;
        btn.innerHTML = '<div class="pay-spinner"></div><span>Đang xử lý...</span>';
        btn.style.background = '#f59e0b'; // Amber for processing
        btn.style.cursor = 'not-allowed';
        btn.style.transform = 'scale(0.98)';
        btn.style.boxShadow = 'none';

        const method = document.querySelector('input[name="payment_method"]:checked').value;
        const methodLabels = {
            'cod': 'Thanh toán khi đến (COD)',
            'bank': 'Chuyển khoản ngân hàng',
            'ewallet': 'Ví điện tử'
        };

        // Get booking amount
        const bookings = typeof getBookings === 'function' ? getBookings() : [];
        const b = bookings.find(item => item.id === bookingId);
        const amount = b ? b.amount : 0;

        // Initialize payment history array if not exists
        window.paymentHistory = window.paymentHistory || [];

        // Simulate network delay (1.5 seconds)
        setTimeout(() => {
            // Randomly determine success or failure (70% success rate)
            const isSuccess = Math.random() > 0.3;
            
            const now = new Date();
            const timeStr = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN');

            if (isSuccess) {
                // Save successful transaction
                window.paymentHistory.push({
                    orderId: bookingId,
                    amount: amount,
                    method: method,
                    status: 'success',
                    time: timeStr
                });

                btn.innerHTML = '✔ Giao dịch thành công';
                btn.style.background = '#22c55e'; // Bright Green
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 10px 25px rgba(34, 197, 94, 0.3)';

                setTimeout(() => {
                    // Tự động chuyển trạng thái đơn hàng: pending -> confirmed
                    if (b && (b.status === 'pending')) {
                        b.status = 'confirmed';
                    }

                    showSuccessPopup(bookingId, methodLabels[method]);
                }, 400);
            } else {
                // Save failed transaction
                window.paymentHistory.push({
                    orderId: bookingId,
                    amount: amount,
                    method: method,
                    status: 'failed',
                    time: timeStr
                });

                btn.innerHTML = '✖ Giao dịch thất bại';
                btn.style.background = '#ef4444'; // Bright Red
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 10px 25px rgba(239, 68, 68, 0.3)';

                setTimeout(() => {
                    showErrorPopup();
                    
                    // Reset button to allow retry
                    btn.disabled = false;
                    btn.innerHTML = 'Xác nhận thanh toán';
                    btn.style.background = '#22c55e';
                    btn.style.cursor = 'pointer';
                }, 500);
            }

        }, 1500);
    };

    function showErrorPopup() {
        const overlay = document.createElement('div');
        overlay.className = 'pay-success-overlay'; // Reuse overlay style
        overlay.innerHTML = `
            <div class="pay-success-modal">
                <div class="pay-success-icon" style="color: #ef4444;">⚠️</div>
                <h3 style="font-size: 24px; font-weight: 900; color: #1a1a2e; margin-bottom: 12px;">Thanh toán thất bại!</h3>
                <p style="color: #64748b; font-size: 15px; margin-bottom: 32px; line-height: 1.6;">
                    Giao dịch không thể hoàn tất do lỗi kết nối cổng thanh toán hoặc ngân hàng từ chối. Vui lòng thử lại.
                </p>
                <button onclick="document.body.removeChild(this.closest('.pay-success-overlay'));" 
                        style="width: 100%; background: #ef4444; color: #fff; border: none; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 800; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.2);">
                    Thử lại
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function showSuccessPopup(bookingId, methodName) {
        const overlay = document.createElement('div');
        overlay.className = 'pay-success-overlay';
        overlay.innerHTML = `
            <div class="pay-success-modal">
                <div class="pay-success-icon">🎉</div>
                <h3 style="font-size: 24px; font-weight: 900; color: #1a1a2e; margin-bottom: 12px;">Thanh toán thành công!</h3>
                <p style="color: #64748b; font-size: 15px; margin-bottom: 32px; line-height: 1.6;">
                    Giao dịch cho đơn hàng <b style="color:#764ba2;">#${bookingId}</b> qua <b>${methodName}</b> đã được ghi nhận. Hệ thống đã cập nhật trạng thái đơn thành "Đã xác nhận".
                </p>
                <button onclick="document.body.removeChild(this.closest('.pay-success-overlay')); if(window.navigateToView) window.navigateToView('bookings');" 
                        style="width: 100%; background: linear-gradient(135deg, #764ba2 0%, #667eea 100%); color: #fff; border: none; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 800; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 25px rgba(118, 75, 162, 0.2);">
                    Quay lại đơn hàng
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

})();
