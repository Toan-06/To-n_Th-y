/**
 * serviceCard.js
 * Component hiển thị danh sách dịch vụ dạng card
 * Yêu cầu: mockData.js phải được load trước
 *
 * Cách dùng:
 *   <div id="service-grid"></div>
 *   <script src="mockData.js"></script>
 *   <script src="serviceCard.js"></script>
 *   <script> renderServices(getAllServices()); </script>
 */

// ─────────────────────────────────────────
//  CSS — Inject tự động vào <head>
// ─────────────────────────────────────────
(function injectStyles() {
  if (document.getElementById('svc-card-styles')) return;
  const style = document.createElement('style');
  style.id = 'svc-card-styles';
  style.textContent = `
    /* Grid container */
    .svc-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      padding: 4px 0;
    }
    @media (max-width: 1200px) { .svc-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 860px)  { .svc-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 540px)  { .svc-grid { grid-template-columns: 1fr; } }

    /* Card */
    .svc-card {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #ede8ff;
      box-shadow: 0 2px 8px rgba(118, 75, 162, 0.06);
      transition: transform 0.25s cubic-bezier(.22,.68,0,1.2),
                  box-shadow 0.25s ease;
      cursor: pointer;
      position: relative;
    }
    .svc-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 16px 40px rgba(118, 75, 162, 0.18);
      border-color: #c4b5fd;
    }

    /* Ảnh */
    .svc-card__img {
      position: relative;
      height: 160px;
      overflow: hidden;
      background: #f3f0ff;
    }
    .svc-card__img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .svc-card:hover .svc-card__img img {
      transform: scale(1.06);
    }

    /* Badge trạng thái */
    .svc-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      color: #fff;
      z-index: 10;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .svc-badge--active  { background: #22c55e; }
    .svc-badge--pending { background: #f59e0b; }
    .svc-badge--paused  { background: #64748b; }

    /* Loại dịch vụ (type chip) */
    .svc-type-chip {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.9);
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      backdrop-filter: blur(8px);
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Body */
    .svc-card__body { padding: 14px; }

    .svc-card__name {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 5px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .svc-card__loc {
      font-size: 12px;
      color: #888;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Giá */
    .svc-card__price {
      font-size: 17px;
      font-weight: 800;
      color: #764ba2;
      margin-bottom: 10px;
      line-height: 1;
    }
    .svc-card__price span {
      font-size: 11px;
      font-weight: 500;
      color: #aaa;
      margin-left: 2px;
    }

    /* Footer — rating + lượt đặt */
    .svc-card__foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid #f3f0ff;
    }
    .svc-rating {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #f59e0b;
    }
    .svc-rating .count {
      color: #aaa;
      font-weight: 400;
    }
    .svc-bookings {
      font-size: 12px;
      color: #888;
    }
    .svc-bookings strong {
      color: #1a1a2e;
      font-weight: 700;
    }

    /* Empty state */
    .svc-empty {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem;
      color: #aaa;
      font-size: 15px;
    }
  `;
  document.head.appendChild(style);
})();

// ─────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────
const _fmt = new Intl.NumberFormat('vi-VN');

function _formatPrice(price) {
  return _fmt.format(price);
}

function _badgeClass(status) {
  return { active: 'svc-badge--active', pending: 'svc-badge--pending', paused: 'svc-badge--paused' }[status] || 'svc-badge--paused';
}

function _badgeLabel(status) {
  return { active: 'Đang hoạt động', pending: 'Chờ duyệt', paused: 'Tạm dừng' }[status] || 'Tạm dừng';
}

function _ratingStars(rating) {
  if (!rating) return '<span class="count">Chưa có đánh giá</span>';
  return `⭐ ${rating} <span class="count">(${rating})</span>`;
}

// ─────────────────────────────────────────
//  Hàm Render Skeleton (Loading)
// ─────────────────────────────────────────
function renderSkeletonServices(containerId = 'service-grid', count = 8) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!document.getElementById('svc-skel-styles')) {
    const s = document.createElement('style');
    s.id = 'svc-skel-styles';
    s.textContent = `
      .svc-skel { background:#fff; border-radius:16px; border:1px solid #f0ecff; overflow:hidden; display:flex; flex-direction:column; height:340px; box-shadow:0 4px 16px rgba(118,75,162,0.03); }
      .sk-img { height:160px; }
      .sk-body { padding:16px; flex:1; display:flex; flex-direction:column; gap:12px; }
      .sk-line { height:14px; border-radius:6px; }
      .sk-t1 { height:20px; width:90%; }
      .sk-t2 { height:20px; width:60%; margin-bottom:8px; }
      .sk-p { height:24px; width:50%; margin-top:auto; }
      .sk-f { height:16px; width:100%; border-top:1px solid #f0ecff; padding-top:12px; margin-top:8px; }
      .sk-anim {
        background: linear-gradient(90deg, #f0f0f5 25%, #f8f8fc 50%, #f0f0f5 75%);
        background-size: 200% 100%;
        animation: sk-loading 1.5s infinite linear;
      }
      @keyframes sk-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    `;
    document.head.appendChild(s);
  }
  
  const html = `
    <div class="svc-skel">
      <div class="sk-img sk-anim"></div>
      <div class="sk-body">
        <div class="sk-line sk-t1 sk-anim"></div>
        <div class="sk-line sk-t2 sk-anim"></div>
        <div class="sk-line sk-anim" style="width:40%"></div>
        <div class="sk-line sk-p sk-anim"></div>
        <div class="sk-line sk-f sk-anim"></div>
      </div>
    </div>`;
    
  container.className = 'svc-grid';
  container.innerHTML = Array(count).fill(html).join('');
}

// ─────────────────────────────────────────
//  Hàm tạo HTML một card
// ─────────────────────────────────────────
function _createCardHTML(svc) {
  const badgeText = _badgeLabel(svc.status);
  const badgeClass = _badgeClass(svc.status);
  
  return `
    <div class="svc-card" data-id="${svc.id}">
      <div class="svc-card__img">
        <img src="${svc.image}" alt="${svc.name}" loading="lazy">
        <div class="svc-badge ${badgeClass}">${badgeText}</div>
        <div class="svc-type-chip">${svc.type}</div>
      </div>
      <div class="svc-card__body">
        <div class="svc-card__name">${svc.name}</div>
        <div class="svc-card__loc">📍 ${svc.location}</div>
        <div class="svc-card__price">
          ${_formatPrice(svc.price)} <span>VND / ${svc.unit}</span>
        </div>
        <div class="svc-card__foot">
          <div class="svc-rating">${_ratingStars(svc.rating)}</div>
          <div class="svc-bookings">Đã đặt: <strong>${svc.bookings}</strong></div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────
//  renderServices(services, containerId?)
// ─────────────────────────────────────────
/**
 * Render danh sách dịch vụ dạng card vào container
 * @param {Array}  services    - Mảng dữ liệu dịch vụ (từ mockData.js)
 * @param {string} containerId - ID của div chứa (mặc định: 'service-grid')
 */
function renderServices(services, containerId = 'service-grid') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[renderServices] Không tìm thấy #${containerId}`);
    return;
  }

  // Đảm bảo container có class grid
  container.className = 'svc-grid';

  if (!services || services.length === 0) {
    container.innerHTML = '<div class="svc-empty">Không có dịch vụ nào để hiển thị.</div>';
    return;
  }

  container.innerHTML = services.map(_createCardHTML).join('');

  // Click handler — có thể mở rộng sau
  container.querySelectorAll('.svc-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      console.log('[serviceCard] Click vào dịch vụ:', id);
      // Dispatch custom event để các module khác có thể lắng nghe
      document.dispatchEvent(new CustomEvent('svc:click', { detail: { id } }));
    });
  });
}
