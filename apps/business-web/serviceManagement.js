/**
 * serviceManagement.js — localStorage version (no backend required)
 */
(function() {
    'use strict';

    const LS_KEY = 'biz_services';

    const state = {
        services: [],
        filter: 'all',
        search: '',
        editingId: null
    };

    // ── Styles ──────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .sm-container { max-width:1400px; margin:0 auto; font-family:'Inter',sans-serif; }
        .sm-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:32px; }
        .sm-title { font-size:28px; font-weight:900; color:#0f172a; }
        .sm-btn-primary { background:linear-gradient(135deg,#6366f1,#4f46e5); color:white; border:none; padding:14px 28px; border-radius:14px; font-weight:700; cursor:pointer; transition:all .3s; box-shadow:0 10px 20px rgba(99,102,241,.25); font-size:15px; }
        .sm-btn-primary:hover { transform:translateY(-3px); box-shadow:0 15px 30px rgba(99,102,241,.35); }

        .sm-filters { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px; background:#fff; padding:16px; border-radius:20px; border:1px solid #f1f5f9; }
        .sm-tabs { display:flex; gap:8px; background:#f1f5f9; padding:6px; border-radius:14px; }
        .sm-tab { padding:10px 20px; border-radius:10px; cursor:pointer; font-size:14px; font-weight:700; color:#64748b; transition:all .2s; user-select:none; }
        .sm-tab.active { background:#fff; color:#6366f1; box-shadow:0 4px 12px rgba(0,0,0,.05); }
        .sm-search { padding:12px 20px; border-radius:14px; border:2px solid #e2e8f0; width:280px; font-size:14px; outline:none; transition:all .2s; background:#f8fafc; }
        .sm-search:focus { border-color:#6366f1; background:#fff; }

        .sm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:24px; padding-bottom:40px; }
        .sm-card { background:#fff; border-radius:16px; border:1px solid #f1f5f9; box-shadow:0 4px 15px rgba(0,0,0,.04); overflow:hidden; transition:all .3s; display:flex; flex-direction:column; }
        .sm-card:hover { transform:translateY(-6px); box-shadow:0 20px 40px rgba(0,0,0,.08); }
        .sm-card-img { width:100%; height:180px; object-fit:cover; background:#e2e8f0; }
        .sm-card-body { padding:20px; flex:1; display:flex; flex-direction:column; }
        .sm-card-title { font-size:17px; font-weight:800; margin-bottom:8px; color:#0f172a; }
        .sm-card-loc { font-size:13px; color:#64748b; margin-bottom:12px; font-weight:500; }
        .sm-card-price { font-size:19px; font-weight:900; color:#10b981; margin-bottom:4px; }
        .sm-card-unit { font-size:13px; color:#64748b; font-weight:600; }
        .sm-card-stats { display:flex; justify-content:space-between; font-size:13px; color:#64748b; margin:12px 0; }
        .sm-card-actions { display:flex; gap:8px; margin-top:auto; padding-top:16px; border-top:1px solid #f1f5f9; }
        .sm-btn-action { flex:1; padding:10px; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; border:none; background:#f1f5f9; color:#334155; transition:all .2s; }
        .sm-btn-action:hover { background:#e2e8f0; }
        .sm-btn-action.delete { color:#ef4444; }
        .sm-btn-action.delete:hover { background:#fef2f2; }

        .sm-badge { padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; display:inline-block; text-transform:uppercase; }
        .sm-badge.active { background:#ecfdf5; color:#059669; }
        .sm-badge.pending { background:#fffbeb; color:#d97706; }
        .sm-badge.paused { background:#f1f5f9; color:#475569; }

        .sm-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.5); backdrop-filter:blur(6px); z-index:9999; align-items:center; justify-content:center; }
        .sm-modal-overlay.active { display:flex; }
        .sm-modal { background:#fff; border-radius:24px; padding:36px; width:100%; max-width:600px; max-height:90vh; overflow-y:auto; }
        .sm-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px; }
        .sm-form-group { display:flex; flex-direction:column; gap:8px; }
        .sm-form-group.full { grid-column:1/-1; }
        .sm-form-label { font-size:13px; font-weight:700; color:#374151; }
        .sm-form-control { padding:12px 16px; border-radius:12px; border:2px solid #e5e7eb; font-size:14px; transition:all .2s; outline:none; }
        .sm-form-control:focus { border-color:#6366f1; box-shadow:0 0 0 4px rgba(99,102,241,.1); }
        .sm-modal-actions { display:flex; gap:12px; justify-content:flex-end; }
        .sm-btn-cancel { padding:12px 24px; border-radius:12px; border:2px solid #e5e7eb; background:#fff; font-weight:700; cursor:pointer; color:#374151; }

        .sm-empty { grid-column:1/-1; text-align:center; padding:80px; background:#fff; border-radius:24px; border:2px dashed #e2e8f0; }

        #sm-toast { position:fixed; top:24px; right:24px; z-index:99999; padding:14px 24px; border-radius:12px; font-weight:700; font-size:14px; box-shadow:0 10px 30px rgba(0,0,0,.15); transition:all .3s; }
    `;
    document.head.appendChild(style);

    // ── localStorage helpers ────────────────────────────────────
    function load() {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
    }

    function save(list) {
        localStorage.setItem(LS_KEY, JSON.stringify(list));
    }

    function seed() {
        const existing = load();
        if (existing.length > 0) return;
        const samples = [
            { id: 's1', name: 'Tour Hạ Long VIP 2N1Đ', category: 'tour', location: 'Quảng Ninh', price: 2500000, unit: 'người', status: 'active', rating: 4.8, bookings: 124, image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80', desc: 'Khám phá vẻ đẹp kỳ vĩ của vịnh Hạ Long trên du thuyền 5 sao đẳng cấp.', createdAt: new Date().toISOString() },
            { id: 's2', name: 'Khách sạn Mường Thanh Grand', category: 'hotel', location: 'Đà Nẵng', price: 1800000, unit: 'đêm', status: 'active', rating: 4.5, bookings: 87, image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', desc: 'Vị trí đắc địa gần bãi biển Mỹ Khê, phòng ốc hiện đại và dịch vụ tận tâm.', createdAt: new Date().toISOString() },
            { id: 's3', name: 'Nhà hàng Bếp Việt Hội An', category: 'restaurant', location: 'Hội An', price: 350000, unit: 'người', status: 'active', rating: 4.7, bookings: 203, image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80', desc: 'Thưởng thức tinh hoa ẩm thực phố cổ trong không gian hoài niệm.', createdAt: new Date().toISOString() },
            { id: 's4', name: 'Tour Sapa Trekking 3N2Đ', category: 'tour', location: 'Lào Cai', price: 3200000, unit: 'người', status: 'pending', rating: 0, bookings: 0, image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', desc: 'Trải nghiệm văn hóa bản địa và chinh phục đỉnh Fansipan hùng vĩ.', createdAt: new Date().toISOString() },
            { id: 's5', name: 'Nghỉ dưỡng Phú Quốc 5 Sao', category: 'hotel', location: 'Phú Quốc', price: 4500000, unit: 'đêm', status: 'paused', rating: 4.9, bookings: 56, image: 'https://images.unsplash.com/photo-1540202404-a2f29016b523?w=600&q=80', desc: 'Thiên đường nghỉ dưỡng riêng tư với bãi biển riêng và hồ bơi vô cực.', createdAt: new Date().toISOString() },
        ];
        save(samples);
    }

    // ── Utils ───────────────────────────────────────────────────
    function genId() { return 's' + Date.now(); }

    function formatMoney(n) {
        if (!n && n !== 0) return 'Liên hệ';
        return new Intl.NumberFormat('vi-VN').format(n) + ' VND';
    }

    function toast(msg, type = 'success') {
        let el = document.getElementById('sm-toast');
        if (el) el.remove();
        el = document.createElement('div');
        el.id = 'sm-toast';
        el.style.background = type === 'error' ? '#ef4444' : '#10b981';
        el.style.color = '#fff';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-10px)';
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
    }

    function debounce(fn, ms) {
        let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }

    // ── Compute filtered list ───────────────────────────────────
    function getFiltered() {
        let list = state.services.slice();
        if (state.filter !== 'all') list = list.filter(s => s.status === state.filter);
        if (state.search) {
            const q = state.search.toLowerCase();
            list = list.filter(s =>
                (s.name || '').toLowerCase().includes(q) ||
                (s.location || '').toLowerCase().includes(q)
            );
        }
        return list;
    }

    // ── Render ──────────────────────────────────────────────────
    function badge(status) {
        const map = { active: ['active','Đang hoạt động'], pending: ['pending','Chờ duyệt'], paused: ['paused','Tạm dừng'] };
        const [cls, label] = map[status] || ['paused', status];
        return `<span class="sm-badge ${cls}">${label}</span>`;
    }

    function typeLabel(cat) {
        return { tour: '🗺️ Tour', hotel: '🏨 Khách sạn', restaurant: '🍽️ Nhà hàng' }[cat] || '📦 Khác';
    }

    function renderGrid() {
        const grid = document.getElementById('sm-grid');
        if (!grid) return;
        const list = getFiltered();
        if (!list.length) {
            grid.innerHTML = `<div class="sm-empty"><div style="font-size:40px;margin-bottom:16px">📭</div><h3 style="color:#475569">Không có dịch vụ nào</h3><p style="color:#94a3b8;margin-top:8px">Nhấn "+ Thêm dịch vụ mới" để bắt đầu</p></div>`;
            return;
        }
        grid.innerHTML = list.map(s => {
            const img = s.image || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80';
            return `
            <div class="sm-card">
                <img src="${img}" class="sm-card-img" alt="${s.name}" onerror="this.src='https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80'">
                <div class="sm-card-body">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                        ${badge(s.status)}
                        <span style="font-size:12px;color:#64748b;font-weight:800;background:#f1f5f9;padding:4px 10px;border-radius:12px">${typeLabel(s.category)}</span>
                    </div>
                    <h3 class="sm-card-title">${s.name}</h3>
                    <div class="sm-card-loc">📍 ${s.location || 'Chưa cập nhật'}</div>
                    <div class="sm-card-price">${formatMoney(s.price)}<span class="sm-card-unit">${s.unit ? ' / ' + s.unit : ''}</span></div>
                    <div class="sm-card-stats">
                        <span>⭐ ${s.rating || 'Chưa có đánh giá'}</span>
                        <span>🔥 <b>${s.bookings || 0}</b> lượt đặt</span>
                    </div>
                    <div class="sm-card-actions">
                        <button class="sm-btn-action" onclick="window.smActions.toggle('${s.id}')">Trạng thái</button>
                        <button class="sm-btn-action" onclick="window.smActions.edit('${s.id}')">✏️ Sửa</button>
                        <button class="sm-btn-action" style="color:#6366f1;font-weight:800" onclick="window.ChatBox&&window.ChatBox.open('${s.id}','${(s.name||'').replace(/'/g,'')}')">💬 Hỗ trợ</button>
                        <button class="sm-btn-action delete" onclick="window.smActions.delete('${s.id}')">🗑️</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // ── Actions ─────────────────────────────────────────────────
    window.smActions = {
        toggle(id) {
            const list = load();
            const idx = list.findIndex(s => s.id === id);
            if (idx < 0) return;
            const cycle = { active: 'paused', paused: 'pending', pending: 'active' };
            list[idx].status = cycle[list[idx].status] || 'active';
            save(list);
            state.services = list;
            renderGrid();
            toast('Cập nhật trạng thái thành công');
        },

        delete(id) {
            if (!confirm('🚨 Bạn có chắc muốn xóa dịch vụ này?')) return;
            const list = load().filter(s => s.id !== id);
            save(list);
            state.services = list;
            renderGrid();
            toast('Đã xóa dịch vụ');
        },

        edit(id) {
            state.editingId = id;
            const svc = load().find(s => s.id === id);
            if (!svc) return;
            document.getElementById('sm-modal-title').textContent = '✏️ Chỉnh sửa dịch vụ';
            document.getElementById('sm-form-name').value = svc.name || '';
            document.getElementById('sm-form-category').value = svc.category || 'tour';
            document.getElementById('sm-form-location').value = svc.location || '';
            document.getElementById('sm-form-price').value = svc.price || '';
            document.getElementById('sm-form-unit').value = svc.unit || 'người';
            document.getElementById('sm-form-image').value = svc.image || '';
            document.getElementById('sm-form-desc').value = svc.desc || '';
            document.getElementById('sm-modal-wrapper').classList.add('active');
        },

        add() {
            state.editingId = null;
            document.getElementById('sm-modal-title').textContent = '✨ Thêm dịch vụ mới';
            ['sm-form-name','sm-form-location','sm-form-price','sm-form-image','sm-form-desc'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            document.getElementById('sm-form-category').value = 'tour';
            document.getElementById('sm-form-unit').value = 'người';
            document.getElementById('sm-modal-wrapper').classList.add('active');
        },

        closeModal() {
            document.getElementById('sm-modal-wrapper').classList.remove('active');
        },

        save() {
            const name = document.getElementById('sm-form-name').value.trim();
            const category = document.getElementById('sm-form-category').value;
            const location = document.getElementById('sm-form-location').value.trim();
            const priceRaw = document.getElementById('sm-form-price').value;
            const price = priceRaw === '' ? null : Number(priceRaw);
            const unit = document.getElementById('sm-form-unit').value;
            const image = document.getElementById('sm-form-image').value.trim();
            const desc = document.getElementById('sm-form-desc').value.trim();

            if (!name || !location) {
                toast('⚠️ Vui lòng điền Tên và Địa điểm!', 'error'); return;
            }

            const list = load();
            if (state.editingId) {
                const idx = list.findIndex(s => s.id === state.editingId);
                if (idx >= 0) Object.assign(list[idx], { name, category, location, price, unit, image, desc });
                toast('Cập nhật thành công');
            } else {
                list.unshift({ id: genId(), name, category, location, price, unit, image, desc, status: 'pending', rating: 0, bookings: 0, createdAt: new Date().toISOString() });
                toast('Tạo dịch vụ thành công');
            }
            save(list);
            state.services = list;
            this.closeModal();
            renderGrid();
        }
    };

    // ── Bootstrap ───────────────────────────────────────────────
    window.initServiceManagement = function() {
        const wrapper = document.getElementById('service-mgmt-container');
        if (!wrapper) return;

        wrapper.innerHTML = `
        <div class="sm-container">
            <div class="sm-header">
                <h2 class="sm-title">Quản lý dịch vụ</h2>
                <button class="sm-btn-primary" onclick="window.smActions.add()">+ Thêm dịch vụ mới</button>
            </div>
            <div class="sm-filters">
                <div class="sm-tabs" id="sm-tabs">
                    <div class="sm-tab active" data-filter="all">Tất cả</div>
                    <div class="sm-tab" data-filter="active">Đang hoạt động</div>
                    <div class="sm-tab" data-filter="pending">Chờ duyệt</div>
                    <div class="sm-tab" data-filter="paused">Tạm dừng</div>
                </div>
                <input type="text" class="sm-search" id="sm-search-input" placeholder="🔍 Tìm kiếm tên, địa điểm...">
            </div>
            <div class="sm-grid" id="sm-grid"></div>

            <div class="sm-modal-overlay" id="sm-modal-wrapper">
                <div class="sm-modal">
                    <h3 id="sm-modal-title" style="font-size:22px;font-weight:900;margin-bottom:28px;color:#0f172a"></h3>
                    <div class="sm-form-grid">
                        <div class="sm-form-group full">
                            <label class="sm-form-label">Tên dịch vụ *</label>
                            <input type="text" id="sm-form-name" class="sm-form-control" placeholder="Ví dụ: Tour Hạ Long 5 Sao VIP">
                        </div>
                        <div class="sm-form-group">
                            <label class="sm-form-label">Phân loại</label>
                            <select id="sm-form-category" class="sm-form-control">
                                <option value="tour">🗺️ Tour</option>
                                <option value="hotel">🏨 Khách sạn</option>
                                <option value="restaurant">🍽️ Nhà hàng</option>
                            </select>
                        </div>
                        <div class="sm-form-group">
                            <label class="sm-form-label">Địa điểm *</label>
                            <input type="text" id="sm-form-location" class="sm-form-control" placeholder="Ví dụ: Quảng Ninh">
                        </div>
                        <div class="sm-form-group">
                            <label class="sm-form-label">Giá niêm yết (VNĐ)</label>
                            <input type="number" id="sm-form-price" class="sm-form-control" placeholder="Để trống nếu 'Liên hệ'">
                        </div>
                        <div class="sm-form-group">
                            <label class="sm-form-label">Đơn vị tính</label>
                            <select id="sm-form-unit" class="sm-form-control">
                                <option value="người">người</option>
                                <option value="đêm">đêm</option>
                                <option value="vé">vé</option>
                                <option value="bàn">bàn</option>
                            </select>
                        </div>
                        <div class="sm-form-group full">
                            <label class="sm-form-label">Link ảnh đại diện (Tùy chọn)</label>
                            <input type="text" id="sm-form-image" class="sm-form-control" placeholder="https://...">
                        </div>
                        <div class="sm-form-group full">
                            <label class="sm-form-label">Mô tả ngắn</label>
                            <textarea id="sm-form-desc" class="sm-form-control" style="height:100px;resize:none" placeholder="Nhập mô tả hấp dẫn để thu hút khách hàng..."></textarea>
                        </div>
                    </div>
                    <div class="sm-modal-actions">
                        <button class="sm-btn-cancel" onclick="window.smActions.closeModal()">Hủy bỏ</button>
                        <button class="sm-btn-primary" onclick="window.smActions.save()">Lưu dịch vụ</button>
                    </div>
                </div>
            </div>
        </div>`;

        // Events
        document.getElementById('sm-search-input').addEventListener('input', debounce(e => {
            state.search = e.target.value; renderGrid();
        }, 250));

        document.querySelectorAll('.sm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sm-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.filter = tab.dataset.filter;
                renderGrid();
            });
        });

        // Seed + load
        seed();
        state.services = load();
        renderGrid();
    };

})();
