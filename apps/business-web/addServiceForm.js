/**
 * addServiceForm.js
 * Form thêm dịch vụ mới dạng Modal
 *
 * Load order:
 *   mockData.js → serviceCard.js → filterServices.js → searchServices.js → addServiceForm.js
 *
 * Cách dùng:
 *   <div id="modal-root"></div>
 *   <button class="btn-add" id="btn-open-add">Thêm dịch vụ</button>
 *   initAddServiceForm('modal-root', '#btn-open-add');
 */

// ─────────────────────────────────────────
//  Inject CSS cho Modal & Form
// ─────────────────────────────────────────
(function injectModalStyles() {
  if (document.getElementById('add-svc-styles')) return;
  const style = document.createElement('style');
  style.id = 'add-svc-styles';
  style.textContent = `
    /* Modal Overlay */
    .svc-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(10, 17, 30, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }
    .svc-modal-overlay.is-open {
      opacity: 1;
      visibility: visible;
    }

    /* Modal Content */
    .svc-modal {
      background: #ffffff;
      width: 100%;
      max-width: 500px;
      border-radius: 20px;
      box-shadow: 0 24px 48px rgba(118, 75, 162, 0.15);
      transform: translateY(20px);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .svc-modal-overlay.is-open .svc-modal {
      transform: translateY(0);
    }

    /* Header */
    .svc-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid #f0ecff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8f5ff;
    }
    .svc-modal-title {
      font-size: 18px;
      font-weight: 800;
      color: #1a1a2e;
      margin: 0;
    }
    .svc-modal-close {
      background: #ede8ff;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 16px;
      color: #764ba2;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.2s;
    }
    .svc-modal-close:hover {
      background: #c4b5fd;
      transform: scale(1.1);
    }

    /* Form Body */
    .svc-form {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .svc-form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .svc-form-label {
      font-size: 13px;
      font-weight: 700;
      color: #444;
    }
    
    .svc-form-input {
      border: 1.5px solid #ede8ff;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      color: #1a1a2e;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #fcfbff;
    }
    .svc-form-input:focus {
      outline: none;
      border-color: #764ba2;
      box-shadow: 0 0 0 3px rgba(118, 75, 162, 0.1);
      background: #fff;
    }
    
    .svc-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    /* Footer */
    .svc-modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #f0ecff;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: #faf8ff;
    }
    
    .svc-btn {
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.1s, opacity 0.2s;
      border: none;
    }
    .svc-btn:active { transform: scale(0.96); }
    
    .svc-btn-cancel {
      background: #fff;
      color: #666;
      border: 1px solid #ddd;
    }
    .svc-btn-cancel:hover { background: #f5f5f5; }
    
    .svc-btn-submit {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      box-shadow: 0 4px 12px rgba(118, 75, 162, 0.3);
    }
    .svc-btn-submit:hover {
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
})();

// ─────────────────────────────────────────
//  addService(service) - Core Function
// ─────────────────────────────────────────
/**
 * Thêm dịch vụ mới vào danh sách và cập nhật giao diện
 * @param {Object} service - Dữ liệu dịch vụ mới
 */
function addService(service) {
  const allServices = getAllServices();
  
  // 1. Tạo ID mới
  const newIdNum = allServices.length + 1;
  const newId = 'SVC' + String(newIdNum).padStart(3, '0');
  
  // 2. Format object dịch vụ
  const newService = {
    id: newId,
    name: service.name.trim(),
    type: service.type,
    location: service.location.trim(),
    price: Number(service.price),
    unit: service.type === 'khách sạn' || service.type === 'villa' ? 'đêm' : 'người',
    rating: 0,
    bookings: 0,
    status: 'pending', // Mặc định chờ duyệt khi mới thêm
    image: service.image.trim() || 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600'
  };
  
  // 3. Thêm vào đầu danh sách mockData
  allServices.unshift(newService);
  
  console.log('[addService] Đã thêm thành công:', newService);
  
  // 4. Update UI
  // Nếu có hệ thống search + filter thì trigger nó để vẽ lại
  if (typeof _applyFilters === 'function') {
      const gridId = 'service-grid'; 
      const countEl = document.getElementById('_svc_result_count');
      _applyFilters(gridId, countEl);
      
      // Update badge đếm ở các tab nếu tab đang tồn tại
      const tabBar = document.getElementById('tab-bar');
      if (tabBar && typeof _renderTabBar === 'function') {
         // Lấy tab đang active hiện tại
         const activeTab = tabBar.querySelector('.filter-tab.is-active');
         const currentStatus = activeTab ? activeTab.dataset.status : 'all';
         _renderTabBar(tabBar, gridId, currentStatus);
      }
  } else if (typeof filterServices === 'function') {
      const activeTab = document.querySelector('.filter-tab.is-active');
      const status = activeTab ? activeTab.dataset.status : 'all';
      filterServices(status);
  } else if (typeof renderServices === 'function') {
      renderServices(allServices, 'service-grid');
  }

  // Update Dashboard Stats realtime
  if (typeof renderStats === 'function') {
      renderStats('dashboard-stats');
  }
}

// ─────────────────────────────────────────
//  Khởi tạo Modal Form
// ─────────────────────────────────────────
/**
 * @param {string} rootId - ID của thẻ div sẽ chứa Modal
 * @param {string} triggerSelector - CSS selector của nút để mở Modal (VD: '#btn-add' hoặc '.add-btn')
 */
function initAddServiceForm(rootId = 'modal-root', triggerSelector = '.btn-add') {
  const root = document.getElementById(rootId);
  if (!root) {
    console.warn(`[addServiceForm] Không tìm thấy #${rootId}`);
    return;
  }
  
  // Build HTML cho Modal
  root.innerHTML = `
    <div class="svc-modal-overlay" id="add-svc-overlay">
      <div class="svc-modal">
        <div class="svc-modal-header">
          <h3 class="svc-modal-title">Thêm dịch vụ mới</h3>
          <button class="svc-modal-close" id="add-svc-close" title="Đóng">✕</button>
        </div>
        
        <form id="add-svc-form">
          <div class="svc-form">
            <div class="svc-form-group">
              <label class="svc-form-label">Tên dịch vụ *</label>
              <input type="text" id="svc-input-name" class="svc-form-input" placeholder="VD: Khách sạn 5 sao..." required>
            </div>
            
            <div class="svc-form-row">
              <div class="svc-form-group">
                <label class="svc-form-label">Loại dịch vụ *</label>
                <select id="svc-input-type" class="svc-form-input" required>
                  <option value="trai-nghiem">Trải nghiệm / Tour</option>
                  <option value="khach-san">Khách sạn / Nghỉ dưỡng</option>
                  <option value="nha-hang">Nhà hàng / Ẩm thực</option>
                  <option value="giai-tri">Giải trí / Vui chơi</option>
                  <option value="diem-du-lich">Điểm tham quan</option>
                </select>
              </div>
              <div class="svc-form-group">
                <label class="svc-form-label">Giá thấp nhất (VND) *</label>
                <input type="number" id="svc-input-price" class="svc-form-input" placeholder="VD: 1500000" min="0" required>
              </div>
            </div>

            <div class="svc-form-group" style="flex-direction: row; align-items: center; gap: 10px; background: #f0f7ff; padding: 10px; border-radius: 10px;">
              <input type="checkbox" id="svc-input-istour" style="width: 18px; height: 18px; cursor: pointer;">
              <label for="svc-input-istour" class="svc-form-label" style="cursor: pointer; margin: 0;">Dịch vụ này là Tour du lịch (Trọn gói / Lịch trình sẵn)</label>
            </div>
            
            <div class="svc-form-group">
              <label class="svc-form-label">Địa điểm / Khu vực *</label>
              <input type="text" id="svc-input-loc" class="svc-form-input" placeholder="VD: Hạ Long, Quảng Ninh" required>
            </div>

            <div class="svc-form-group">
              <label class="svc-form-label">Mô tả tổng quan</label>
              <textarea id="svc-input-desc" class="svc-form-input" style="height:80px;" placeholder="Giới thiệu ngắn về dịch vụ của bạn..."></textarea>
            </div>
            
            <div class="svc-form-group">
              <label class="svc-form-label">Danh sách Ảnh (URLs, ngăn cách bằng dấu phẩy)</label>
              <textarea id="svc-input-imgs" class="svc-form-input" placeholder="https://image1.jpg, https://image2.jpg..."></textarea>
            </div>

            <div class="svc-form-group">
              <label class="svc-form-label">Link Video giới thiệu (Youtube/TikTok)</label>
              <input type="url" id="svc-input-video" class="svc-form-input" placeholder="https://www.youtube.com/watch?v=...">
            </div>
          </div>
          
          <div class="svc-modal-footer">
            <button type="button" class="svc-btn svc-btn-cancel" id="add-svc-cancel">Hủy</button>
            <button type="submit" class="svc-btn svc-btn-submit" id="add-svc-submit-btn">Đăng dịch vụ</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // -- REPLACEMENT FOR addService FUNCTION --
  window.addService = async function(service) {
    const btn = document.getElementById('add-svc-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đăng...'; }

    try {
      const token = localStorage.getItem('biz_auth_token') || 
                    sessionStorage.getItem('biz_auth_token') ||
                    localStorage.getItem('wander_business_token') || 
                    sessionStorage.getItem('wander_business_token') ||
                    localStorage.getItem('wander_token');

      const res = await fetch('/api/business/places', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          name: service.name,
          kind: service.type,
          isTour: service.isTour,
          priceFrom: service.price,
          region: service.location,
          description: service.description,
          images: service.images,
          videoUrl: service.videoUrl
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Dịch vụ đã được gửi lên hệ thống và đang chờ phê duyệt!');
        location.reload(); 
      } else {
        // Nếu lỗi Auth, yêu cầu đăng nhập lại
        if (data.message && (data.message.includes('Auth') || data.message.includes('JWT'))) {
           alert('Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
           window.bizLogout(); // Hàm đã có trong biz-extend.js
           return;
        }
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Đăng dịch vụ'; }
    }
  };
  
  // Element references
  const overlay = document.getElementById('add-svc-overlay');
  const form = document.getElementById('add-svc-form');
  const btnClose = document.getElementById('add-svc-close');
  const btnCancel = document.getElementById('add-svc-cancel');
  
  // Mở modal
  const triggers = document.querySelectorAll(triggerSelector);
  triggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.classList.add('is-open');
    });
  });
  
  // Đóng modal
  const closeModal = () => {
    overlay.classList.remove('is-open');
    form.reset();
  };
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  
  // Đóng khi click ra ngoài overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  
  // Xử lý Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Lấy data từ form mới
    const serviceData = {
      name: document.getElementById('svc-input-name').value,
      type: document.getElementById('svc-input-type').value,
      isTour: document.getElementById('svc-input-istour').checked,
      price: document.getElementById('svc-input-price').value,
      location: document.getElementById('svc-input-loc').value,
      description: document.getElementById('svc-input-desc').value,
      videoUrl: document.getElementById('svc-input-video').value,
      images: document.getElementById('svc-input-imgs').value.split(',').map(s => s.trim()).filter(Boolean)
    };
    
    // Gọi hàm Core (đã được window-scoped ở trên)
    window.addService(serviceData);
  });
}
