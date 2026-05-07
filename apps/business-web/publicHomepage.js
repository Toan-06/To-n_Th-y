/**
 * publicHomepage.js — Giao diện Trang chủ Doanh nghiệp Chuyên nghiệp (Ultimate Edition)
 * Thiết kế đẳng cấp, tối ưu UX/UI, đầy đủ các module: Hero, Services, Intro, Stats, Portfolio, Testimonials, CTA & Footer.
 */
(function () {
    'use strict';

    // ── Data Helpers ─────────────────────────────────────────────
    function getServices() {
        const stored = JSON.parse(localStorage.getItem('biz_services') || '[]');
        const defaults = [
            { id: 'd1', type: 'tour', name: 'Tour Hạ Long VIP 2N1Đ', price: 2500000, rating: 4.9, reviews: 124, image: 'https://images.unsplash.com/photo-1559592481-74488ea01cf2?w=800&q=80', isHot: true, location: 'Vịnh Hạ Long, Quảng Ninh', desc: 'Trải nghiệm du thuyền 5 sao giữa kỳ quan thiên nhiên thế giới.', amenities: ['🌊 Vịnh biển 3.000+ hòn đảo','🚢 Du thuyền hạng sang','🤿 Chèo kayak & bơi biển','🍽️ Bữa ăn hải sản cao cấp','🏰 Tham quan đảo Ti Top','🌅 Đồng Ngăm nhận đệp','🩸 HD viên chuyên nghiệp','🚌 Đưa đón tận nơi'] },
            { id: 'd2', type: 'tour', name: 'Nha Trang Beach Holiday', price: 1800000, rating: 4.8, reviews: 89, image: 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=800&q=80', isHot: false, location: 'Nha Trang, Khánh Hòa', desc: 'Tận hưởng kỳ nghỉ biển tuyệt vời tại thành phố biển Nha Trang xinh đẹp.', amenities: ['🏖️ Bãi biển cát trắng dài 7km','🌊 Biển xanh trong vắt','🤿 Lặn biển san hô','🏨 Khách sạn 4-5 sao ven biển','🐟 Chợ đầm hải sản tươi sống','💧 Spa & massage cao cấp','🎉 Vinpearl Land giải trí','🌄 Hoàng hôn biển tuyệt đẹp'] },
            { id: 'd3', type: 'consult', name: 'Khách sạn 1000 Sao Luxury', price: 3500000, rating: 4.9, reviews: 203, image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80', isHot: true, location: 'Quận 1, TP. Hồ Chí Minh', desc: 'Dịch vụ lưu trú đẳng cấp quốc tế với tầm nhìn Panorama toàn cảnh thành phố.', amenities: ['🌆 Tầm nhìn thành phố 360°','🏊 Bể bơi vô cực trên thiên đường','🍽️ Nhà hàng thượng đỉnh','💪 Trung tâm thể dục gym & yoga','🚧 Thư viện & khu vực công tác','💫 Minibar & phòng suite cao cấp','🚗 Butler service 24/7','💆 Spa & wellness cấp 5 sao'] },
            { id: 'd4', type: 'tour', name: 'Tour Khám phá Đà Nẵng', price: 1200000, rating: 4.7, reviews: 45, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', isHot: false, location: 'Đà Nẵng & Hội An', desc: 'Hành trình di sản: Ngũ Hành Sơn - Hội An - Bà Nà Hills.', amenities: ['🗻 Ngũ Hành Sơn huyền bí','🌉 Cầu Vàng trên Bà Nà Hills','🏞️ Phố cổ Hội An lung linh đèn lồng','🐡 Cù lao Chàm đảo hoang sơ','🏾 Làng chài nước non','🎪 Sun World đỉnh hấp dẫn','🍼 Ẩm thực địa phương đa dạng','🚌 Xe đưa đón riêng biệt'] },
            { id: 'd5', type: 'tech', name: 'Vé máy bay Thương gia', price: 5000000, rating: 5.0, reviews: 67, image: 'https://images.unsplash.com/photo-1436491865332-7a61a109c05a?w=800&q=80', isHot: true, location: 'Quốc tế & Nội địa', desc: 'Đưa đón tận nơi, phòng chờ hạng sang và trải nghiệm bay đẳng cấp nhất.', amenities: ['🏧 Phòng chờ Business Lounge','🦺 Rượu vang & ăn ngị miễn phí','💺 Ghế nằm đầy đủ tiện ích','💆 Massage chân tại chỗ','🎧 Hệ thống giải trí riêng','🛑 Ưu tiên kiểm tra úm hành lý','🚗 Liồu xe đưa đón hạng sang','📦 Hành lý 50kg miễn phí'] },
            { id: 'd6', type: 'marketing', name: 'Thuê xe Limousine 9 chỗ', price: 1500000, rating: 4.9, reviews: 31, image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', isHot: false, location: 'Toàn quốc', desc: 'Di chuyển sang trọng, tiện nghi và riêng tư cho đoàn khách gia đình.', amenities: ['🚗 Xe mới 100% 2023-2024','❄️ Điều hòa 2 chiều mhát','📹 Camera an ninh & GPS','🎵 Dàn âm thanh cao cấp','📡 Wifi 4G tốc độ cao','💺 9 ghế rộng rãi, có đệm','💺 Ngăn hành lý riêng biệt','👨‍💼 Tài xế chuyên nghiệp'] }
        ];
        // Merge: stored items first, then defaults that don't have matching id
        const storedIds = stored.map(s => s.id || s._id);
        const mergedDefaults = defaults.filter(d => !storedIds.includes(d.id));
        return [...stored, ...mergedDefaults];
    }

    // Store services globally for modal access
    var _pubServices = [];

    const projects = [
        { title: 'Hệ thống quản lý WanderViệt', category: 'Tech/Software', image: 'https://images.unsplash.com/photo-1551288049-bbda446b17ad?w=600&q=80' },
        { title: 'Chiến dịch "Khám phá Việt Nam"', category: 'Marketing', image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=600&q=80' },
        { title: 'Ứng dụng đặt tour Real-time', category: 'App Development', image: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&q=80' }
    ];

    // ── Styles ───────────────────────────────────────────────────
    const css = `
    .pub-wrapper { background: #fff; color: #1e293b; font-family: 'Be Vietnam Pro', sans-serif; scroll-behavior: smooth; }
    
    /* Reveal Animation */
    .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s ease-out; }
    .reveal.active { opacity: 1; transform: translateY(0); }

    /* Navbar */
    .pub-nav { 
        height: 80px; display: flex; align-items: center; justify-content: space-between; 
        padding: 0 5%; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(15px);
        position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .pub-logo { font-size: 26px; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .pub-logo b { color: #6366f1; }
    .pub-menu { display: flex; gap: 35px; list-style: none; }
    .pub-menu a { text-decoration: none; color: #64748b; font-weight: 600; font-size: 15px; transition: 0.3s; position: relative; }
    .pub-menu a::after { content: ''; position: absolute; bottom: -5px; left: 0; width: 0; height: 2px; background: #6366f1; transition: 0.3s; }
    .pub-menu a:hover { color: #0f172a; }
    .pub-menu a:hover::after { width: 100%; }
    
    /* Hero Section */
    .hero-ultimate { 
        padding: 120px 5%; min-height: 85vh; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 80px; align-items: center;
        background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); position: relative; overflow: hidden;
    }
    .hero-ultimate::before { content: ''; position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background: rgba(99, 102, 241, 0.05); border-radius: 50%; filter: blur(80px); }
    .hero-tag { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 50px; font-weight: 700; font-size: 13px; color: #6366f1; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
    .hero-ultimate h1 { font-size: 64px; font-weight: 900; color: #0f172a; line-height: 1.1; margin-bottom: 25px; letter-spacing: -2px; }
    .hero-ultimate p { font-size: 19px; color: #64748b; line-height: 1.6; margin-bottom: 45px; max-width: 550px; }
    .hero-btns { display: flex; gap: 20px; }
    
    .hero-img-stack { position: relative; }
    .hero-main-img { width: 100%; border-radius: 40px; box-shadow: 30px 30px 80px rgba(0,0,0,0.1); position: relative; z-index: 2; }
    .hero-float-card { 
        position: absolute; bottom: 40px; left: -40px; background: #fff; padding: 20px; border-radius: 20px; 
        box-shadow: 0 20px 40px rgba(0,0,0,0.1); z-index: 3; display: flex; align-items: center; gap: 15px;
        animation: float 4s ease-in-out infinite;
    }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

    /* Service Grid */
    .sec-header { text-align: center; max-width: 700px; margin: 0 auto 70px; }
    .sec-header h2 { font-size: 42px; font-weight: 900; color: #0f172a; margin-bottom: 15px; }
    .sec-header p { color: #64748b; font-size: 16px; }

    .service-grid-v3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
    .svc-card-new { background:#fff; border-radius:24px; overflow:hidden; border:1px solid #f1f5f9; transition:all 0.35s cubic-bezier(0.175,0.885,0.32,1.275); }
    .svc-card-new:hover { transform:translateY(-8px); box-shadow:0 24px 48px rgba(0,0,0,0.08); border-color:#6366f1; }
    .svc-card-img { height:200px; background-size:cover; background-position:center; position:relative; }
    .svc-card-img::after { content:''; position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.5), transparent 60%); }
    .svc-badge-hot { position:absolute; top:12px; left:12px; background:#ef4444; color:#fff; font-size:11px; font-weight:800; padding:4px 10px; border-radius:50px; z-index:1; }
    .svc-price-tag { position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,0.65); backdrop-filter:blur(6px); color:#fbbf24; font-size:13px; font-weight:800; padding:5px 12px; border-radius:10px; z-index:1; }
    .svc-card-body { padding:20px; }
    .svc-card-body h4 { font-size:16px; font-weight:800; color:#0f172a; margin-bottom:8px; }
    .svc-card-body p { font-size:13px; color:#64748b; line-height:1.6; margin-bottom:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .svc-rating { display:flex; align-items:center; gap:6px; font-size:13px; }
    .btn-text { color: #6366f1; font-weight: 800; font-size: 14px; text-decoration: none; display: flex; align-items: center; gap: 8px; }

    /* Detail Drawer */
    .pub-detail-overlay { position:fixed !important; inset:0 !important; background:rgba(0,0,0,0.6); backdrop-filter:blur(6px); z-index:99998 !important; opacity:0; pointer-events:none; transition:opacity 0.3s; }
    .pub-detail-overlay.open { opacity:1 !important; pointer-events:all !important; }
    .pub-detail-drawer { position:fixed !important; top:0 !important; right:-600px; width:560px; max-width:95vw; height:100vh !important; background:#fff; z-index:99999 !important; box-shadow:-20px 0 60px rgba(0,0,0,0.15); transition:right 0.4s cubic-bezier(0.16,1,0.3,1); display:flex; flex-direction:column; overflow:hidden; }
    .pub-detail-drawer.open { right:0 !important; }
    .pub-detail-hero { height:260px; background-size:cover; background-position:center; position:relative; flex-shrink:0; }
    .pub-detail-hero::after { content:''; position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%); }
    .pub-detail-close { position:absolute; top:16px; right:16px; width:36px; height:36px; background:rgba(255,255,255,0.2); backdrop-filter:blur(8px); border:none; border-radius:50%; color:#fff; font-size:18px; cursor:pointer; z-index:1; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
    .pub-detail-close:hover { background:rgba(255,255,255,0.35); }
    .pub-detail-hero-info { position:absolute; bottom:20px; left:20px; z-index:1; }
    .pub-detail-hero-info h2 { color:#fff; font-size:22px; font-weight:900; margin-bottom:4px; }
    .pub-detail-hero-info span { color:rgba(255,255,255,0.8); font-size:13px; }
    .pub-detail-body { flex:1; overflow-y:auto; padding:24px; }
    .pub-detail-meta { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
    .pub-detail-chip { padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; }
    .pub-detail-chip.price { background:#fef3c7; color:#d97706; }
    .pub-detail-chip.rating { background:#f0fdf4; color:#15803d; }
    .pub-detail-chip.reviews { background:#eff6ff; color:#2563eb; }
    .pub-detail-chip.hot { background:#fef2f2; color:#dc2626; }
    .pub-detail-desc { font-size:15px; color:#475569; line-height:1.7; margin-bottom:24px; padding:16px; background:#f8fafc; border-radius:14px; border-left:3px solid #6366f1; }
    .pub-detail-section-title { font-size:14px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
    .pub-amenities-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:24px; }
    .pub-amenity-item { display:flex; align-items:center; gap:10px; padding:12px; background:#f8fafc; border-radius:12px; font-size:13px; font-weight:600; color:#334155; border:1px solid #f1f5f9; transition:all 0.2s; }
    .pub-amenity-item:hover { background:#f0f4ff; border-color:#6366f1; color:#4f46e5; }
    .pub-detail-footer { padding:20px 24px; border-top:1px solid #f1f5f9; background:#fff; flex-shrink:0; display:flex; gap:12px; }
    .pub-btn-book { flex:1; padding:14px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:14px; font-weight:800; font-size:15px; cursor:pointer; transition:all 0.2s; }
    .pub-btn-book:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(99,102,241,0.35); }
    .pub-btn-chat { padding:14px 20px; background:#f1f5f9; color:#475569; border:none; border-radius:14px; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s; }
    .pub-btn-chat:hover { background:#e2e8f0; }

    .portfolio-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .portfolio-item { position: relative; border-radius: 30px; overflow: hidden; height: 350px; cursor: pointer; }
    .portfolio-img { width: 100%; height: 100%; object-fit: cover; transition: 0.5s; }
    .portfolio-overlay { 
        position: absolute; inset: 0; background: linear-gradient(to top, rgba(15,23,42,0.9), transparent); 
        display: flex; flex-direction: column; justify-content: flex-end; padding: 30px;
        opacity: 0; transition: 0.4s; transform: translateY(20px);
    }
    .portfolio-item:hover .portfolio-img { transform: scale(1.1); }
    .portfolio-item:hover .portfolio-overlay { opacity: 1; transform: translateY(0); }
    .portfolio-overlay h5 { color: #fff; font-size: 18px; font-weight: 800; margin-bottom: 5px; }
    .portfolio-overlay span { color: #6366f1; font-size: 13px; font-weight: 700; text-transform: uppercase; }

    /* Testimonials */
    .testi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
    .testi-card { background: #f8fafc; padding: 40px; border-radius: 30px; position: relative; }
    .testi-card::before { content: '“'; position: absolute; top: 20px; right: 30px; font-size: 80px; color: #e2e8f0; line-height: 1; font-family: serif; }
    .testi-text { font-size: 15px; line-height: 1.7; color: #475569; margin-bottom: 30px; font-style: italic; position: relative; z-index: 1; }
    .testi-user { display: flex; align-items: center; gap: 15px; }
    .testi-av { width: 50px; height: 50px; border-radius: 50%; background: #6366f1; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; }
    .testi-info h6 { font-size: 15px; font-weight: 800; margin-bottom: 2px; }
    .testi-info span { font-size: 12px; color: #94a3b8; }

    /* CTA Section */
    .cta-v3 { 
        background: #0f172a; padding: 100px 5%; border-radius: 50px; margin: 0 5% 100px;
        display: flex; justify-content: space-between; align-items: center; gap: 40px; color: #fff;
        position: relative; overflow: hidden;
    }
    .cta-v3::after { content: ''; position: absolute; bottom: -50px; right: -50px; width: 200px; height: 200px; background: #6366f1; opacity: 0.1; border-radius: 50%; }
    .cta-v3 h2 { font-size: 48px; font-weight: 900; line-height: 1.1; max-width: 600px; }
    .cta-btns { display: flex; gap: 20px; }

    /* Floating Chat */
    .chat-trigger { 
        position: fixed; bottom: 30px; right: 30px; width: 65px; height: 65px; 
        background: #6366f1; color: #fff; border-radius: 50%; 
        display: flex; align-items: center; justify-content: center; 
        font-size: 28px; cursor: pointer; z-index: 2000;
        box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
        transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .chat-trigger:hover { transform: scale(1.1) rotate(10deg); }

    /* Search Overlay */
    .search-overlay { 
        position: fixed; inset: 0; background: rgba(15,23,42,0.95); backdrop-filter: blur(10px);
        display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 3000;
    }
    .search-input-wrap { width: 600px; max-width: 90%; position: relative; }
    .search-input-v3 { width: 100%; background: transparent; border: none; border-bottom: 3px solid #6366f1; padding: 20px 0; color: #fff; font-size: 32px; font-weight: 700; outline: none; }
    .search-close { position: absolute; top: 40px; right: 40px; color: #fff; font-size: 32px; cursor: pointer; }

    @media (max-width: 1100px) {
        .hero-ultimate { grid-template-columns: 1fr; text-align: center; padding-top: 80px; }
        .hero-ultimate p { margin: 0 auto 40px; }
        .hero-btns { justify-content: center; }
        .service-grid-v3 { grid-template-columns: repeat(2, 1fr); }
        .portfolio-grid, .testi-grid { grid-template-columns: 1fr; }
        .cta-v3 { flex-direction: column; text-align: center; }
    }
    `;

    // ── Components ───────────────────────────────────────────────
    function fmtPrice(p) {
        if (!p || p === 0) return 'Liên hệ';
        if (p >= 1000000) return (p/1000000).toFixed(1).replace('.0','') + 'M ₫';
        return Math.round(p/1000) + 'K ₫';
    }

    function renderStars(r) {
        const n = Math.round(parseFloat(r) || 0);
        return '★'.repeat(Math.min(n,5)) + '☆'.repeat(Math.max(0,5-n));
    }

    function ServiceCard(s) {
        const desc = s.desc || s.description || 'Dịch vụ chất lượng cao từ đối tác WanderViệt.';
        const price = fmtPrice(s.price || s.priceFrom);
        const rating = parseFloat(s.rating || s.ratingAvg || 0);
        const reviewCount = s.reviews || s.reviewCount || 0;
        const img = s.image || 'https://images.unsplash.com/photo-1559592481-74488ea01cf2?w=600&q=80';
        const isHot = s.isHot || false;
        const sid = s.id || s._id || '';
        return `
        <div class="svc-card-new reveal" style="cursor:pointer" onclick="window._openPubSvcDetail('${sid}')">
            <div class="svc-card-img" style="background-image:url('${img}')">
                ${isHot ? '<span class="svc-badge-hot">🔥 HOT</span>' : ''}
                <div class="svc-price-tag">Từ ${price}</div>
                <div style="position:absolute;bottom:12px;left:12px;z-index:1;background:rgba(255,255,255,0.15);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px">👁️ Xem chi tiết</div>
            </div>
            <div class="svc-card-body">
                <h4>${s.name}</h4>
                <p>${desc}</p>
                <div class="svc-rating">
                    <span style="color:#f59e0b">${renderStars(rating)}</span>
                    <span style="font-weight:700;color:#0f172a">${rating > 0 ? rating : '—'}</span>
                    <span style="color:#94a3b8">(${reviewCount} đánh giá)</span>
                </div>
            </div>
        </div>
        `;
    }

    // ── Main Render ──────────────────────────────────────────────
    function render() {
        const svcs = getServices();
        _pubServices = svcs;

        return `
        <div class="pub-wrapper">
            <!-- Navbar -->
            <nav class="pub-nav">
                <div class="pub-logo" onclick="window.scrollTo(0,0)">
                    <b>W</b>anderViệt
                </div>
                <ul class="pub-menu">
                    <li><a href="#home">Trang chủ</a></li>
                    <li><a href="#services">Dịch vụ</a></li>
                    <li><a href="#portfolio">Dự án</a></li>
                    <li><a href="#about">Về chúng tôi</a></li>
                </ul>
                <div style="display:flex; gap:15px; align-items:center">
                    <span style="font-size:20px; cursor:pointer" onclick="document.getElementById('search-v3').style.display='flex'">🔍</span>
                    <button class="btn-pub btn-pub-primary" style="padding:12px 24px" onclick="window.ChatBox.open('global','Tư vấn giải pháp')">LIÊN HỆ NGAY</button>
                </div>
            </nav>

            <!-- Hero Section -->
            <section class="hero-ultimate" id="home">
                <div class="hero-content-wrap">
                    <div class="hero-tag">🚀 Giải pháp tốt nhất cho doanh nghiệp của bạn</div>
                    <h1>Giải pháp tối ưu<br>cho mọi hành trình</h1>
                    <p>Chúng tôi cung cấp hệ sinh thái dịch vụ du lịch và công nghệ hàng đầu, giúp bạn kiến tạo những trải nghiệm đẳng cấp và khác biệt.</p>
                    <div class="hero-btns">
                        <button class="btn-pub btn-pub-primary" onclick="document.getElementById('services').scrollIntoView({behavior:'smooth'})">KHÁM PHÁ DỊCH VỤ</button>
                        <button class="btn-pub btn-pub-white" onclick="window.ChatBox.open('global','Tư vấn giải pháp')">LIÊN HỆ TƯ VẤN</button>
                    </div>
                </div>
                <div class="hero-img-stack">
                    <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1000&q=80" class="hero-main-img" alt="Hero">
                    <div class="hero-float-card">
                        <div style="width:50px; height:50px; background:#6366f1; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px">⭐</div>
                        <div>
                            <div style="font-weight:900; font-size:18px">4.9/5.0</div>
                            <div style="font-size:12px; color:#64748b">Đánh giá từ khách hàng</div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Services Section -->
            <section class="sec-pub" id="services">
                <div class="sec-header">
                    <span class="sec-tag">Dịch vụ chuyên nghiệp</span>
                    <h2>Dịch vụ nổi bật</h2>
                    <p>Hệ sinh thái dịch vụ đa dạng, chất lượng cao từ các đối tác uy tín WanderViệt.</p>
                </div>
                <div class="service-grid-v3" id="pub-svc-grid">
                    ${svcs.map(ServiceCard).join('')}
                </div>
            </section>

            <!-- Live Reviews Section -->
            <section class="sec-pub" id="reviews-pub" style="background:#f8fafc">
                <div class="sec-header">
                    <span class="sec-tag">Khách hàng nói gì?</span>
                    <h2>Đánh giá thực tế</h2>
                    <p>Phản hồi chân thực từ những khách hàng đã trải nghiệm dịch vụ.</p>
                </div>
                <div id="pub-reviews-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;">
                    <div style="grid-column:1/-1;text-align:center;padding:2rem;color:#94a3b8">Đang tải đánh giá...</div>
                </div>
            </section>

            <!-- Portfolio Section -->
            <section class="sec-pub" id="portfolio" style="background:#f8fafc">
                <div class="sec-header">
                    <span class="sec-tag">Dự án & Khách hàng</span>
                    <h2>Dự án tiêu biểu đã thực hiện</h2>
                    <p>Những cột mốc quan trọng trong hành trình phát triển và phục vụ khách hàng của WanderViệt.</p>
                </div>
                <div class="portfolio-grid">
                    ${projects.map(p => `
                        <div class="portfolio-item reveal">
                            <img src="${p.image}" class="portfolio-img">
                            <div class="portfolio-overlay">
                                <span>${p.category}</span>
                                <h5>${p.title}</h5>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>



            <!-- CTA Section -->
            <section class="cta-v3 reveal">
                <h2>Bạn đã sẵn sàng để kiến tạo<br>trải nghiệm khác biệt?</h2>
                <div class="cta-btns">
                    <button class="btn-pub btn-pub-primary" style="background:#fff; color:#6366f1" onclick="window.ChatBox.open('global','Tư vấn ngay')">TƯ VẤN NGAY</button>
                    <button class="btn-pub btn-pub-white" style="background:transparent; color:#fff; border-color:rgba(255,255,255,0.2)" onclick="alert('Hotline: 1900 1234')">GỌI: 1900 1234</button>
                </div>
            </section>

            <!-- Footer (Simple & Professional) -->
            <footer class="pub-footer">
                <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:80px; padding-bottom:60px">
                    <div>
                        <div class="pub-logo" style="color:#fff; margin-bottom:25px"><b>W</b>anderViệt</div>
                        <p style="font-size:14px; line-height:1.7">Giải pháp du lịch và công nghệ hàng đầu Việt Nam. Chúng tôi cam kết mang lại giá trị thực và bền vững cho khách hàng và đối tác.</p>
                    </div>
                    <div>
                        <h5 style="color:#fff; margin-bottom:20px">Dịch vụ</h5>
                        <ul style="list-style:none; font-size:14px; line-height:2">
                            <li>Thiết kế Tour</li>
                            <li>Digital Marketing</li>
                            <li>Giải pháp Tech</li>
                            <li>Tư vấn MICE</li>
                        </ul>
                    </div>
                    <div>
                        <h5 style="color:#fff; margin-bottom:20px">Liên hệ</h5>
                        <ul style="list-style:none; font-size:14px; line-height:2">
                            <li>info@wanderviet.com</li>
                            <li>1900 1234</li>
                            <li>Quận 1, TP. Hồ Chí Minh</li>
                        </ul>
                    </div>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:30px; text-align:center; font-size:12px; color:#64748b">
                    © 2026 WanderViệt Enterprise. All Rights Reserved.
                </div>
            </footer>

            <!-- Search Overlay -->
            <div id="search-v3" class="search-overlay">
                <div class="search-close" onclick="document.getElementById('search-v3').style.display='none'">✕</div>
                <div class="search-input-wrap">
                    <input type="text" class="search-input-v3" placeholder="Tìm kiếm dịch vụ..." onkeydown="if(event.key==='Enter')alert('Đang tìm kiếm...')">
                    <p style="color:#64748b; margin-top:20px; font-weight:600">Nhấn Enter để tìm kiếm</p>
                </div>
            </div>
        </div>
        `;
    }

    // ── Intersection Observer for Scroll Animation ─────────────
    function initScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    // ── Fetch Real Reviews ───────────────────────────────────────
    function loadPublicReviews() {
        const grid = document.getElementById('pub-reviews-grid');
        if (!grid) return;
        const token = localStorage.getItem('biz_auth_token') || localStorage.getItem('wander_business_token') || '';
        fetch('/api/business/reviews', { headers: token ? {'x-auth-token': token} : {} })
            .then(r => r.json())
            .then(json => {
                const list = json.success && json.data ? json.data : [];
                if (!list.length) {
                    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#94a3b8">Chưa có đánh giá nào.</div>';
                    return;
                }
                const colors = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6'];
                grid.innerHTML = list.map((r, i) => {
                    const ini = (r.userName || r.user?.name || 'K').charAt(0).toUpperCase();
                    const name = r.userName || r.user?.name || 'Khách hàng';
                    const comment = r.comment || r.text || '';
                    const stars = '★'.repeat(Math.min(r.rating||0,5))+'☆'.repeat(Math.max(0,5-(r.rating||0)));
                    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '';
                    const svc = r.placeName || r.serviceName || 'Dịch vụ';
                    const clr = colors[i % colors.length];
                    return `<div class="testi-card reveal">
                        <p class="testi-text">"${comment}"</p>
                        <div style="color:#f59e0b;font-size:14px;margin-bottom:12px">${stars}</div>
                        <div class="testi-user">
                            <div class="testi-av" style="background:${clr}">${ini}</div>
                            <div class="testi-info">
                                <h6>${name}</h6>
                                <span>${svc} • ${date}</span>
                            </div>
                        </div>
                    </div>`;
                }).join('');
                setTimeout(initScrollReveal, 50);
            })
            .catch(() => {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#ef4444">Lỗi tải đánh giá.</div>';
            });
    }

    // ── Detail Drawer Logic ─────────────────────────────────
    window._openPubSvcDetail = function(id) {
        // Fallback: refresh list if empty
        if (!_pubServices || !_pubServices.length) _pubServices = getServices();
        const s = _pubServices.find(x => String(x.id||x._id) === String(id));
        if (!s) { console.warn('[Drawer] Service not found:', id, _pubServices.length); return; }

        const price = fmtPrice(s.price || s.priceFrom);
        const rating = parseFloat(s.rating || s.ratingAvg || 0);
        const reviewCount = s.reviews || s.reviewCount || 0;
        const img = s.image || 'https://images.unsplash.com/photo-1559592481-74488ea01cf2?w=800&q=80';
        const desc = s.desc || s.description || '';
        const loc = s.location || s.region || s.address || '';
        const amenities = s.amenities || [];

        // Build amenities HTML
        const amenitiesHtml = amenities.length
            ? amenities.map(a => `<div class="pub-amenity-item">${a}</div>`).join('')
            : '<div style="color:#94a3b8;font-size:13px;grid-column:1/-1">Thông tin tiện ích đang được cập nhật...</div>';

        const drawer = document.getElementById('pub-svc-drawer');
        const overlay = document.getElementById('pub-svc-overlay');
        if (!drawer || !overlay) return;

        drawer.querySelector('.pub-detail-hero').style.backgroundImage = `url('${img}')`;
        drawer.querySelector('.pub-detail-hero-info h2').textContent = s.name;
        drawer.querySelector('.pub-detail-hero-info span').textContent = loc ? '📍 ' + loc : '';
        drawer.querySelector('.pub-detail-body').innerHTML = `
            <div class="pub-detail-meta">
                <span class="pub-detail-chip price">💰 ${price}</span>
                <span class="pub-detail-chip rating">⭐ ${rating > 0 ? rating : 'Mới'}/5</span>
                <span class="pub-detail-chip reviews">💬 ${reviewCount} đánh giá</span>
                ${s.isHot ? '<span class="pub-detail-chip hot">🔥 HOT</span>' : ''}
            </div>
            <div class="pub-detail-desc">${desc}</div>
            <div class="pub-detail-section-title">🏞️ Không gian & Tiện ích</div>
            <div class="pub-amenities-grid">${amenitiesHtml}</div>
        `;

        overlay.classList.add('open');
        setTimeout(() => drawer.classList.add('open'), 10);
    };

    window._closePubSvcDetail = function() {
        const drawer = document.getElementById('pub-svc-drawer');
        const overlay = document.getElementById('pub-svc-overlay');
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    // ── Main Init ────────────────────────────────────────────────
    window.initPublicHome = function () {
        const container = document.getElementById('public-home-view');
        if (!container) return;

        if (!document.getElementById('pub-ultimate-style')) {
            const st = document.createElement('style');
            st.id = 'pub-ultimate-style';
            st.textContent = css;
            document.head.appendChild(st);
        }

        container.innerHTML = render();

        // Always ensure drawer exists in body
        if (!document.getElementById('pub-svc-drawer')) {
            const ov = document.createElement('div');
            ov.id = 'pub-svc-overlay';
            ov.className = 'pub-detail-overlay';
            ov.addEventListener('click', window._closePubSvcDetail);
            document.body.appendChild(ov);

            const dr = document.createElement('div');
            dr.id = 'pub-svc-drawer';
            dr.className = 'pub-detail-drawer';
            dr.innerHTML = [
                '<div class="pub-detail-hero">',
                '  <button class="pub-detail-close" onclick="window._closePubSvcDetail()">&#x2715;</button>',
                '  <div class="pub-detail-hero-info"><h2></h2><span></span></div>',
                '</div>',
                '<div class="pub-detail-body"></div>',
                '<div class="pub-detail-footer">',
                '  <button class="pub-btn-book" onclick="window._closePubSvcDetail();alert(\'Đá gật! Hãy đăng nhập để đặt dịch vụ.\')">🚀 Đặt ngay</button>',
                '  <button class="pub-btn-chat" onclick="window._closePubSvcDetail()">💬 Tư vấn</button>',
                '</div>'
            ].join('');
            document.body.appendChild(dr);
        }

        setTimeout(initScrollReveal, 100);
        loadPublicReviews();

        document.querySelectorAll('.pub-menu a').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId.startsWith('#')) {
                    e.preventDefault();
                    const el = document.querySelector(targetId);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    };

})();
