/**
 * profileManagement.js — Trang hồ sơ doanh nghiệp
 * Route: profile (data-view="profile")
 */
(function () {
    'use strict';

    // ── Lấy dữ liệu user hiện tại ───────────────────────────────
    function getCurrentBiz() {
        var keys = ['biz_auth_user', 'currentUser'];
        for (var i = 0; i < keys.length; i++) {
            var raw = localStorage.getItem(keys[i]) || sessionStorage.getItem(keys[i]);
            if (raw) { try { return JSON.parse(raw); } catch (e) { } }
        }
        return null;
    }

    function getMyServices() {
        var stored = [];
        try { stored = JSON.parse(localStorage.getItem('biz_services') || '[]'); } catch (e) { }
        if (stored.length > 0) return stored;
        // Seed mẫu nếu chưa có
        return [
            { id: 's1', name: 'Tour Hạ Long VIP 2N1Đ',    price: 2500000, unit: 'người', category: 'tour',       status: 'active',  rating: 4.8, bookings: 124, location: 'Quảng Ninh', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80' },
            { id: 's2', name: 'Khách sạn Mường Thanh',     price: 1800000, unit: 'đêm',   category: 'hotel',      status: 'active',  rating: 4.5, bookings: 87,  location: 'Đà Nẵng',   image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80' },
            { id: 's3', name: 'Nhà hàng Bếp Việt Hội An',  price: 350000,  unit: 'người', category: 'restaurant', status: 'active',  rating: 4.7, bookings: 203, location: 'Hội An',    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
            { id: 's4', name: 'Tour Sapa Trekking 3N2Đ',   price: 3200000, unit: 'người', category: 'tour',       status: 'pending', rating: 0,   bookings: 0,   location: 'Lào Cai',   image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80' },
        ];
    }

    function getDefaultBiz(user) {
        return {
            id:          (user && (user.id || user._id)) || 'biz_default',
            name:        (user && (user.name || user.displayName)) || 'Doanh nghiệp của tôi',
            description: (user && user.description) || 'Chúng tôi cung cấp các dịch vụ du lịch cao cấp, trải nghiệm khó quên cho khách hàng trên khắp Việt Nam.',
            address:     (user && user.address) || '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh',
            phone:       (user && user.phone)   || '0901 234 567',
            email:       (user && user.email)   || '',
            website:     (user && user.website) || '',
            category:    (user && user.category)|| 'Tour & Travel',
            founded:     (user && user.founded) || '2020',
            tier:        (user && user.tier)    || 'PARTNER',
        };
    }

    // ── Utils ────────────────────────────────────────────────────
    function formatPrice(n) {
        if (!n && n !== 0) return 'Liên hệ';
        return new Intl.NumberFormat('vi-VN').format(n) + ' VND';
    }

    function statusCfg(s) {
        var map = {
            active:  { label: 'Đang hoạt động', bg: '#ecfdf5', color: '#059669' },
            pending: { label: 'Chờ duyệt',       bg: '#fffbeb', color: '#d97706' },
            paused:  { label: 'Tạm dừng',        bg: '#f1f5f9', color: '#475569' },
        };
        return map[s] || { label: s || 'Không rõ', bg: '#f1f5f9', color: '#64748b' };
    }

    function typeLabel(cat) {
        var map = { tour: '🗺️ Tour', hotel: '🏨 Khách sạn', restaurant: '🍽️ Nhà hàng' };
        return map[cat] || '📦 Dịch vụ';
    }

    function safeName(name) {
        return (name || '').replace(/"/g, '').replace(/'/g, '').replace(/`/g, '');
    }

    // ── CSS ──────────────────────────────────────────────────────
    var css = [
        '.pf-wrap{padding:24px;background:#f1f5f9;min-height:100vh;font-family:"Be Vietnam Pro","Inter",sans-serif}',
        '.pf-cover{height:180px;border-radius:20px;background:linear-gradient(135deg,#667eea,#764ba2,#f093fb);position:relative;margin-bottom:60px}',
        '.pf-avatar{position:absolute;bottom:-44px;left:28px;width:90px;height:90px;border-radius:22px;background:linear-gradient(135deg,#6366f1,#a855f7);border:4px solid #fff;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 8px 24px rgba(99,102,241,.3)}',
        '.pf-cover-btns{position:absolute;bottom:14px;right:16px;display:flex;gap:10px}',
        '.pf-btn{padding:9px 18px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all .2s}',
        '.pf-btn-primary{background:#6366f1;color:#fff}',
        '.pf-btn-primary:hover{background:#4f46e5;transform:translateY(-1px)}',
        '.pf-btn-ghost{background:rgba(255,255,255,.9);color:#374151}',
        '.pf-card{background:#fff;border-radius:20px;box-shadow:0 1px 4px rgba(0,0,0,.06);border:1px solid #f1f5f9;margin-bottom:20px}',
        '.pf-card-head{display:flex;justify-content:space-between;align-items:center;padding:20px 24px 0}',
        '.pf-card-title{font-size:15px;font-weight:800;color:#0f172a}',
        '.pf-card-body{padding:16px 24px 24px}',
        '.pf-biz-name{font-size:24px;font-weight:900;color:#0f172a;margin:0 0 4px}',
        '.pf-biz-desc{font-size:14px;color:#475569;line-height:1.7;margin:8px 0 14px}',
        '.pf-info-chip{display:inline-flex;align-items:center;gap:7px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px 12px;font-size:13px;color:#374151;font-weight:600;margin:4px}',
        '.pf-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}',
        '.pf-stat{background:#fff;border-radius:16px;padding:18px;text-align:center;border:1px solid #f1f5f9;box-shadow:0 1px 4px rgba(0,0,0,.05)}',
        '.pf-stat-val{font-size:26px;font-weight:900;line-height:1}',
        '.pf-stat-lbl{font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}',
        '.pf-layout{display:grid;grid-template-columns:1fr 2fr;gap:18px}',
        '.pf-col{display:flex;flex-direction:column;gap:18px}',
        '.pf-fac-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:8px;font-size:13px;font-weight:600;color:#374151}',
        '.pf-svc-item{display:flex;gap:12px;padding:14px;border-radius:14px;border:1.5px solid #f1f5f9;margin-bottom:10px;transition:all .2s;cursor:pointer}',
        '.pf-svc-item:hover{border-color:#6366f1;box-shadow:0 4px 14px rgba(99,102,241,.1)}',
        '.pf-svc-img{width:76px;height:64px;object-fit:cover;border-radius:11px;flex-shrink:0}',
        '.pf-svc-name{font-size:14px;font-weight:800;color:#0f172a;margin:0 0 4px}',
        '.pf-svc-price{font-size:15px;font-weight:900;color:#10b981}',
        '.pf-svc-unit{font-size:12px;color:#94a3b8;font-weight:500}',
        '.pf-svc-meta{display:flex;gap:10px;font-size:12px;color:#64748b;margin-top:5px;font-weight:600}',
        '.pf-svc-actions{display:flex;gap:8px;margin-top:8px}',
        '.pf-svc-btn{padding:6px 14px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all .2s}',
        '.pf-svc-btn-chat{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}',
        '.pf-svc-btn-chat:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(99,102,241,.35)}',
        '.pf-svc-btn-edit{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}',
        '.pf-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);z-index:9999;align-items:center;justify-content:center}',
        '.pf-modal-overlay.active{display:flex}',
        '.pf-modal{background:#fff;border-radius:24px;padding:32px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto}',
        '.pf-form-label{display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:7px}',
        '.pf-form-ctrl{width:100%;padding:11px 15px;border-radius:11px;border:2px solid #e5e7eb;font-size:14px;outline:none;box-sizing:border-box;transition:all .2s;font-family:inherit}',
        '.pf-form-ctrl:focus{border-color:#6366f1}',
        'textarea.pf-form-ctrl{resize:vertical;min-height:90px}',
        '@media(max-width:900px){.pf-layout{grid-template-columns:1fr}.pf-stats{grid-template-columns:repeat(2,1fr)}}'
    ].join('');

    // ── Build info chips ─────────────────────────────────────────
    function buildInfoChips(biz) {
        var chips = [
            { icon: '📍', text: biz.address },
            { icon: '📞', text: biz.phone },
            { icon: '📧', text: biz.email || 'Chưa cập nhật' },
            { icon: '🏷️', text: biz.category },
            { icon: '📅', text: 'Thành lập ' + biz.founded },
        ];
        return chips.map(function (c) {
            return '<span class="pf-info-chip">' + c.icon + ' ' + c.text + '</span>';
        }).join('');
    }

    // ── Build facilities list ────────────────────────────────────
    function buildFacilities() {
        var items = [
            ['📍', biz.address],
            ['📞', biz.phone],
            ['📧', biz.email || 'Chưa cập nhật'],
            ['🌐', biz.website || 'Chưa cập nhật'],
            ['🏷️', biz.category],
            ['📅', 'Thành lập: ' + biz.founded],
        ];
        return items.map(function (x) {
            return '<div class="pf-fac-item"><span style="font-size:18px">' + x[0] + '</span>' + x[1] + '</div>';
        }).join('');
    }

    // ── Current biz reference ────────────────────────────────────
    var biz = {};

    // ── Build service cards ──────────────────────────────────────
    function buildServiceCards(svcs) {
        if (!svcs.length) {
            return '<div style="text-align:center;padding:50px 20px;color:#94a3b8">' +
                '<div style="font-size:48px;margin-bottom:14px">📭</div>' +
                '<h3 style="color:#475569;margin:0 0 8px">Chưa có dịch vụ</h3>' +
                '<p style="font-size:13px;margin:0 0 18px">Thêm dịch vụ đầu tiên để bắt đầu!</p>' +
                '<button class="pf-btn pf-btn-primary" onclick="window.navigateToView(\'services\')">+ Thêm dịch vụ</button>' +
                '</div>';
        }

        return svcs.map(function (s) {
            var sc    = statusCfg(s.status);
            var img   = s.image || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80';
            var sid   = s.id || s._id || '';
            var sname = safeName(s.name || 'Dịch vụ');

            return '<div class="pf-svc-item">' +
                '<img class="pf-svc-img" src="' + img + '" alt="' + sname + '" onerror="this.src=\'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80\'">' +
                '<div style="flex:1;min-width:0">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">' +
                        '<p class="pf-svc-name">' + (s.name || 'Dịch vụ') + '</p>' +
                        '<span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:800;background:' + sc.bg + ';color:' + sc.color + ';flex-shrink:0">' + sc.label + '</span>' +
                    '</div>' +
                    '<div style="font-size:12px;color:#6366f1;font-weight:700;margin-bottom:4px">' + typeLabel(s.category || s.type) + '</div>' +
                    '<div class="pf-svc-price">' + formatPrice(s.price) + '<span class="pf-svc-unit">' + (s.unit ? ' / ' + s.unit : '') + '</span></div>' +
                    '<div class="pf-svc-meta">' +
                        '<span>📍 ' + (s.location || 'Chưa cập nhật') + '</span>' +
                        '<span>' + (s.rating > 0 ? '⭐ ' + s.rating : '⭐ Chưa có') + '</span>' +
                        '<span>🔥 ' + (s.bookings || 0) + ' đặt</span>' +
                    '</div>' +
                    '<div class="pf-svc-actions">' +
                        '<button class="pf-svc-btn pf-svc-btn-chat" data-sid="' + sid + '" data-sname="' + sname + '">💬 Chăm sóc</button>' +
                        '<button class="pf-svc-btn pf-svc-btn-edit" onclick="window.navigateToView(\'services\')">✏️ Sửa</button>' +
                    '</div>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    // ── Main render ──────────────────────────────────────────────
    function render() {
        var user  = getCurrentBiz();
        biz       = getDefaultBiz(user);
        var svcs  = getMyServices();

        var totalBookings = svcs.reduce(function (s, x) { return s + (x.bookings || 0); }, 0);
        var activeCount   = svcs.filter(function (s) { return s.status === 'active'; }).length;
        var ratedSvcs     = svcs.filter(function (s) { return s.rating > 0; });
        var avgRating     = ratedSvcs.length
            ? (ratedSvcs.reduce(function (s, x) { return s + x.rating; }, 0) / ratedSvcs.length).toFixed(1)
            : '—';

        var handle = '@' + biz.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        var html = '' +
        '<div class="pf-wrap">' +

            // Cover
            '<div class="pf-cover">' +
                '<div class="pf-avatar">🏨</div>' +
                '<div class="pf-cover-btns">' +
                    '<button class="pf-btn pf-btn-ghost" onclick="window.pfActions.edit()">✏️ Chỉnh sửa</button>' +
                    '<button class="pf-btn pf-btn-primary" onclick="window.navigateToView(\'services\')">+ Thêm dịch vụ</button>' +
                '</div>' +
            '</div>' +

            // Info card
            '<div class="pf-card">' +
                '<div class="pf-card-body">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">' +
                        '<div style="flex:1">' +
                            '<h1 class="pf-biz-name" id="pf-display-name">' + biz.name + '</h1>' +
                            '<div style="font-size:13px;color:#6366f1;font-weight:700;margin-bottom:8px">' + handle + '</div>' +
                            '<p class="pf-biz-desc" id="pf-display-desc">' + biz.description + '</p>' +
                            '<div id="pf-chips">' + buildInfoChips(biz) + '</div>' +
                        '</div>' +
                        '<span style="background:#ede9fe;color:#6d28d9;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:800;flex-shrink:0">' + biz.tier + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Stats
            '<div class="pf-stats">' +
                '<div class="pf-stat"><div class="pf-stat-val" style="color:#6366f1">' + svcs.length + '</div><div class="pf-stat-lbl">Dịch vụ</div></div>' +
                '<div class="pf-stat"><div class="pf-stat-val" style="color:#10b981">' + activeCount + '</div><div class="pf-stat-lbl">Đang hoạt động</div></div>' +
                '<div class="pf-stat"><div class="pf-stat-val" style="color:#f59e0b">' + totalBookings + '</div><div class="pf-stat-lbl">Lượt đặt</div></div>' +
                '<div class="pf-stat"><div class="pf-stat-val" style="color:#ef4444">' + avgRating + '</div><div class="pf-stat-lbl">Rating TB</div></div>' +
            '</div>' +

            // 2-column layout
            '<div class="pf-layout">' +

                // Cột trái: thông tin & tiện ích
                '<div class="pf-col">' +
                    '<div class="pf-card">' +
                        '<div class="pf-card-head"><div class="pf-card-title">🛎️ Thông tin liên hệ</div></div>' +
                        '<div class="pf-card-body">' + buildFacilities() + '</div>' +
                    '</div>' +
                    '<div class="pf-card">' +
                        '<div class="pf-card-head"><div class="pf-card-title">✨ Tiện ích nổi bật</div></div>' +
                        '<div class="pf-card-body" style="display:flex;flex-wrap:wrap;gap:8px">' +
                            ['🚗 Đưa đón','🍽️ Bữa ăn','🛡️ Bảo hiểm','📸 Chụp ảnh','🎧 HDV','🏊 Hồ bơi','📶 Wifi','🅿️ Đỗ xe','♻️ Eco','💳 Online'].map(function (f) {
                                return '<span style="padding:7px 13px;background:#eff6ff;border:1px solid #c7d2fe;border-radius:10px;font-size:12px;font-weight:700;color:#3730a3">' + f + '</span>';
                            }).join('') +
                        '</div>' +
                    '</div>' +
                '</div>' +

                // Cột phải: dịch vụ
                '<div class="pf-col">' +
                    '<div class="pf-card">' +
                        '<div class="pf-card-head">' +
                            '<div class="pf-card-title">🧳 Dịch vụ của tôi</div>' +
                            '<a style="font-size:13px;color:#6366f1;font-weight:700;cursor:pointer" onclick="window.navigateToView(\'services\')">Quản lý →</a>' +
                        '</div>' +
                        '<div class="pf-card-body" id="pf-svc-list">' + buildServiceCards(svcs) + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Edit modal
            '<div class="pf-modal-overlay" id="pf-modal">' +
                '<div class="pf-modal">' +
                    '<h3 style="font-size:20px;font-weight:900;margin:0 0 22px;color:#0f172a">✏️ Chỉnh sửa hồ sơ</h3>' +
                    '<div style="margin-bottom:16px"><label class="pf-form-label">Tên doanh nghiệp</label><input type="text" id="pf-edit-name" class="pf-form-ctrl" value="' + biz.name + '"></div>' +
                    '<div style="margin-bottom:16px"><label class="pf-form-label">Mô tả</label><textarea id="pf-edit-desc" class="pf-form-ctrl">' + biz.description + '</textarea></div>' +
                    '<div style="margin-bottom:16px"><label class="pf-form-label">Địa chỉ</label><input type="text" id="pf-edit-addr" class="pf-form-ctrl" value="' + biz.address + '"></div>' +
                    '<div style="margin-bottom:16px"><label class="pf-form-label">Số điện thoại</label><input type="text" id="pf-edit-phone" class="pf-form-ctrl" value="' + biz.phone + '"></div>' +
                    '<div style="margin-bottom:16px"><label class="pf-form-label">Email</label><input type="email" id="pf-edit-email" class="pf-form-ctrl" value="' + biz.email + '"></div>' +
                    '<div style="margin-bottom:20px"><label class="pf-form-label">Website</label><input type="text" id="pf-edit-web" class="pf-form-ctrl" value="' + biz.website + '" placeholder="https://..."></div>' +
                    '<div style="display:flex;gap:10px;justify-content:flex-end">' +
                        '<button class="pf-btn pf-btn-ghost" onclick="window.pfActions.closeModal()">Hủy</button>' +
                        '<button class="pf-btn pf-btn-primary" onclick="window.pfActions.save()">💾 Lưu hồ sơ</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

        return html;
    }

    // ── Wire chat buttons after render ───────────────────────────
    function wireChatButtons() {
        document.querySelectorAll('.pf-svc-btn-chat').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sid   = btn.getAttribute('data-sid');
                var sname = btn.getAttribute('data-sname');
                if (window.ChatBox) window.ChatBox.open(sid, sname);
            });
        });
    }

    // ── Global actions ───────────────────────────────────────────
    window.pfActions = {
        edit: function () { document.getElementById('pf-modal').classList.add('active'); },
        closeModal: function () { document.getElementById('pf-modal').classList.remove('active'); },
        save: function () {
            biz.name        = document.getElementById('pf-edit-name').value.trim()  || biz.name;
            biz.description = document.getElementById('pf-edit-desc').value.trim()  || biz.description;
            biz.address     = document.getElementById('pf-edit-addr').value.trim()  || biz.address;
            biz.phone       = document.getElementById('pf-edit-phone').value.trim() || biz.phone;
            biz.email       = document.getElementById('pf-edit-email').value.trim();
            biz.website     = document.getElementById('pf-edit-web').value.trim();

            // Persist
            var user = getCurrentBiz() || {};
            Object.assign(user, biz);
            localStorage.setItem('biz_auth_user', JSON.stringify(user));

            updateIdentity(biz); // Cập nhật sidebar

            this.closeModal();
            window.initProfile();

            // Toast
            var t = document.createElement('div');
            t.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;padding:14px 24px;border-radius:12px;background:#10b981;color:#fff;font-weight:700;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.15)';
            t.textContent = '✅ Đã lưu hồ sơ thành công!';
            document.body.appendChild(t);
            setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2500);
        }
    };

    function updateIdentity(biz) {
        if (!biz) return;
        var nameElems = [document.getElementById('sidebar-name'), document.getElementById('topbar-username')];
        nameElems.forEach(function (el) { if(el) el.textContent = biz.name; });
        var tierEl = document.getElementById('sidebar-tier');
        if (tierEl) tierEl.textContent = biz.tier || 'PARTNER';
    }

    // ── Main init ────────────────────────────────────────────────
    window.initProfile = function () {
        var wrapper = document.getElementById('profile-mgmt-container');
        if (!wrapper) return;

        // Inject CSS once
        if (!document.getElementById('pf-style')) {
            var st = document.createElement('style');
            st.id = 'pf-style';
            st.textContent = css;
            document.head.appendChild(st);
        }

        wrapper.innerHTML = render();
        updateIdentity(biz);
        wireChatButtons();
    };

}());
