import React, { useEffect, useMemo, useState } from 'react';
import Auth from './Auth';
import { authService } from './authService';
import ChatBot from './components/ChatBot';

const EMPTY_FORM = {
  name: '',
  category: '',
  region: '',
  address: '',
  description: '',
  image: '',
  images: [], // Thêm mảng ảnh
  videoUrl: '', // Thêm video
  priceFrom: '',
  priceTo: '',
  openTime: '',
  closeTime: '',
  openDays: '',
  contactPhone: '',
  contactEmail: '',
  website: '',
  amenities: [],
  status: 'pending'
};

function formatVnd(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `${amount.toLocaleString('vi-VN')}đ` : 'Liên hệ';
}

export default function BusinessDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({ totalServices: 0, totalViews: 0, totalReviews: 0, avgRating: '0.0' });
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('biz_token') || sessionStorage.getItem('biz_token') || localStorage.getItem('wander_token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    try {
      const data = await authService.checkAuth(token);
      if (data.success) {
        setUser(data.user);
        fetchData(token);
      } else {
        localStorage.removeItem('biz_token');
      }
    } catch (err) {
      console.error('Lỗi xác thực', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchData = async (token) => {
    try {
      const [placesRes, statsRes] = await Promise.all([
        fetch('/api/business/places', { headers: { 'x-auth-token': token } }),
        fetch('/api/business/stats', { headers: { 'x-auth-token': token } })
      ]);
      const placesData = await placesRes.json();
      const statsData = await statsRes.json();
      if (placesData.success) setServices(placesData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Lỗi lấy dữ liệu', err);
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    const token = localStorage.getItem('biz_token') || sessionStorage.getItem('biz_token') || localStorage.getItem('wander_token');
    fetchData(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('biz_token');
    localStorage.removeItem('wander_token');
    setUser(null);
    setServices([]);
  };

  const filteredServices = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return services;
    return services.filter((item) => {
      const hitName = item.name.toLowerCase().includes(keyword);
      const hitCategory = (item.kind || item.category || '').toLowerCase().includes(keyword);
      const hitRegion = (item.region || '').toLowerCase().includes(keyword);
      return hitName || hitCategory || hitRegion;
    });
  }, [query, services]);

  const approvedServices = useMemo(
    () => services.filter((item) => item.status === 'approved'),
    [services]
  );

  const openCreate = () => {
    setEditingService(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingService(item);
    setFormData({
      ...EMPTY_FORM,
      ...item,
      category: item.kind || item.category,
      amenities: Array.isArray(item.amenities) ? item.amenities : []
    });
    setIsModalOpen(true);
  };

  const onFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onAmenityChange = (event) => {
    const { value, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      amenities: checked
        ? [...prev.amenities, value]
        : prev.amenities.filter((item) => item !== value)
    }));
  };

  const onImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, image: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('biz_token') || sessionStorage.getItem('biz_token') || localStorage.getItem('wander_token');
    try {
      const url = editingService ? `/api/business/places/${editingService.id}` : '/api/business/places';
      const method = editingService ? 'PUT' : 'POST';

      // Parse images array if string
      let finalImages = formData.images;
      if (typeof finalImages === 'string') {
        finalImages = finalImages.split(',').map(s => s.trim()).filter(Boolean);
      }

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({
          ...formData,
          kind: formData.category,
          images: finalImages
        })
      });
      
      const data = await res.json();
      if (data.success) {
        if (editingService) {
          setServices(prev => prev.map(s => s.id === data.data.id ? data.data : s));
        } else {
          setServices(prev => [data.data, ...prev]);
        }
        setIsModalOpen(false);
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Không thể lưu dịch vụ. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa dịch vụ này?')) return;
    const token = localStorage.getItem('biz_token') || sessionStorage.getItem('biz_token') || localStorage.getItem('wander_token');
    try {
      const res = await fetch(`/api/business/places/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (data.success) {
        setServices(prev => prev.filter(s => s.id !== id));
      } else {
        alert('Lỗi khi xóa: ' + data.message);
      }
    } catch (err) {
      alert('Không thể xóa dịch vụ.');
    }
  };

  if (authLoading) {
    return <div className="biz-auth-wrapper"><div className="auth-subtitle">Đang tải...</div></div>;
  }

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="biz-layout">
      <aside className="biz-sidebar">
        <div className="biz-sidebar-header">
          <div className="logo" style={{ fontSize: '1.2rem' }}>
            <span className="logo-mark">◈</span>
            WanderViệt Doanh nghiệp
          </div>
        </div>
        <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem', background: 'var(--biz-surface-light)', borderRadius: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--biz-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {user.displayName?.charAt(0) || user.name?.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'white' }}>{user.displayName || user.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--biz-text-muted)' }}>{user.email}</div>
            </div>
          </div>
        </div>
        <nav className="biz-nav">
          <button className={`biz-nav-item ${activeSection === 'overview' ? 'is-active' : ''}`} onClick={() => setActiveSection('overview')}>
            Tổng quan
          </button>
          <button className={`biz-nav-item ${activeSection === 'services' ? 'is-active' : ''}`} onClick={() => setActiveSection('services')}>
            Quản lý dịch vụ
          </button>
          <button className={`biz-nav-item ${activeSection === 'preview' ? 'is-active' : ''}`} onClick={() => setActiveSection('preview')}>
            Xem trước người dùng
          </button>
          <button className={`biz-nav-item ${activeSection === 'messages' ? 'is-active' : ''}`} onClick={() => setActiveSection('messages')}>
            Chăm sóc khách hàng
          </button>
        </nav>
        <div style={{ padding: '1.5rem' }}>
          <button onClick={handleLogout} className="btn-biz btn-biz--danger" style={{ width: '100%', justifyContent: 'center' }}>Đăng xuất</button>
        </div>
      </aside>

      <main className="biz-content">
        <header className="biz-content-header">
          <div className="header-breadcrumb">Trang chủ hệ sinh thái doanh nghiệp</div>
          <button className="btn-biz btn-biz--primary" onClick={openCreate}>
            + Đăng dịch vụ mới
          </button>
        </header>

        <div className="biz-view">
          {activeSection === 'overview' && (
            <>
              <div className="biz-stats-row">
                <div className="stat-card"><div className="stat-label">Tổng dịch vụ</div><div className="stat-val">{stats.totalServices}</div></div>
                <div className="stat-card"><div className="stat-label">Đang hiển thị</div><div className="stat-val">{approvedServices.length}</div></div>
                <div className="stat-card"><div className="stat-label">Tổng lượt xem / thích</div><div className="stat-val">❤️ {stats.totalViews?.toLocaleString('vi-VN')}</div></div>
                <div className="stat-card"><div className="stat-label">Đánh giá TB</div><div className="stat-val">⭐ {stats.avgRating || '0.0'}</div></div>
              </div>
              <div className="biz-panel">
                <h2 className="biz-panel-title">Mục tiêu hệ sinh thái doanh nghiệp</h2>
                <p className="section-copy">
                  Doanh nghiệp đăng tải dịch vụ và tiện ích du lịch đầy đủ thông tin. Sau khi được duyệt, dữ liệu sẽ xuất hiện
                  ở giao diện người dùng theo dạng thẻ điểm đến để khách hàng có thể lựa chọn và sử dụng.
                </p>
              </div>
            </>
          )}

          {activeSection === 'services' && (
            <div className="biz-panel">
              <div className="biz-panel-header">
                <h2 className="biz-panel-title">Danh sách dịch vụ doanh nghiệp</h2>
              </div>
              <div className="biz-search-row">
                <input
                  type="search"
                  className="biz-search-input"
                  placeholder="Tìm theo tên, phân loại, khu vực..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table className="biz-table">
                  <thead>
                    <tr>
                      <th>Dịch vụ</th>
                      <th>Phân loại</th>
                      <th>Giá từ</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="service-name-cell">
                            <img className="service-thumb" src={item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600'} alt={item.name} />
                            <div>
                              <strong>{item.name}</strong>
                              <small className="service-address">{item.region} - {item.address}</small>
                            </div>
                          </div>
                        </td>
                        <td><span className="biz-tag">{item.kind || item.category}</span></td>
                        <td>{formatVnd(item.priceFrom)}</td>
                        <td>
                          <span className={`status-badge status-badge--${item.status}`}>
                            {item.status === 'approved' ? 'Đang hiển thị' : 'Chờ duyệt'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <button className="btn-biz btn-biz--ghost btn--sm" onClick={() => openEdit(item)}>Sửa</button>
                            <button className="btn-biz btn-biz--ghost btn--sm" style={{ color: '#f43f5e' }} onClick={() => onDelete(item.id)}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredServices.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--biz-text-muted)' }}>
                          Chưa có dịch vụ nào được tìm thấy.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'preview' && (
            <div className="biz-panel">
              <h2 className="biz-panel-title">Xem trước trang người dùng</h2>
              <p className="section-copy">
                Các dịch vụ được duyệt sẽ hiển thị thành thẻ để khách hàng chọn sử dụng, tương tự các điểm du lịch khác.
              </p>
              <div className="tour-grid">
                {approvedServices.map((item) => (
                  <article className="travel-card" key={item.id}>
                    <img className="travel-card-img" src={item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200'} alt={item.name} />
                    <div className="travel-card-overlay">
                      <h3 className="travel-card-title">{item.name}</h3>
                      <p style={{ margin: '0.35rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>{item.description}</p>
                      <div className="travel-card-meta">
                        <span>📍 {item.region}</span>
                        <span>⭐ {item.ratingAvg || 0}</span>
                        <span>💰 {formatVnd(item.priceFrom)}</span>
                      </div>
                    </div>
                  </article>
                ))}
                {approvedServices.length === 0 && (
                  <p style={{ padding: '1rem', color: 'var(--biz-text-muted)' }}>Bạn chưa có dịch vụ nào được duyệt.</p>
                )}
              </div>
            </div>
          )}

          {activeSection === 'messages' && (
            <div className="biz-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '24px 24px 0' }}>
                <h2 className="biz-panel-title">Trợ lý ảo AI - Chăm sóc khách hàng</h2>
                <p className="section-copy">Hệ thống AI tự động trả lời các thắc mắc cơ bản của khách hàng về dịch vụ của bạn.</p>
              </div>
              <ChatBot mode="embedded" />
            </div>
          )}
        </div>
      </main>

      {isModalOpen && <div className="biz-modal-overlay" onClick={() => setIsModalOpen(false)} />}
      {isModalOpen && (
        <div className="biz-modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '2rem' }}>
          <div className="biz-modal-content" style={{ maxWidth: '800px' }}>
            <div className="biz-modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--biz-border)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{editingService ? 'Cập nhật dịch vụ' : 'Đăng tải dịch vụ mới'}</h3>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div className="biz-modal-body">
              <form className="biz-auth-form" onSubmit={onSubmit}>
                <div className="field-row two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="field">
                    <label>Tên dịch vụ *</label>
                    <input required name="name" value={formData.name} onChange={onFieldChange} />
                  </div>
                  <div className="field">
                    <label>Phân loại *</label>
                    <input required name="category" value={formData.category} onChange={onFieldChange} placeholder="VD: Khách sạn, Nhà hàng" />
                  </div>
                </div>
                <div className="field">
                  <label>Khu vực *</label>
                  <input required name="region" value={formData.region} onChange={onFieldChange} placeholder="VD: Đà Nẵng, Hội An" />
                </div>
                <div className="field">
                  <label>Địa chỉ chi tiết *</label>
                  <input required name="address" value={formData.address} onChange={onFieldChange} />
                </div>
                <div className="field">
                  <label>Mô tả dịch vụ *</label>
                  <textarea 
                    required 
                    rows="3" 
                    name="description" 
                    value={formData.description} 
                    onChange={onFieldChange} 
                    style={{ width: '100%', background: 'var(--biz-surface-light)', color: 'white', border: '1px solid var(--biz-border)', borderRadius: '12px', padding: '0.8rem 1rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="field-row two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="field"><label>Giá từ (VND) *</label><input required name="priceFrom" type="number" value={formData.priceFrom} onChange={onFieldChange} /></div>
                  <div className="field"><label>Giá đến (VND)</label><input name="priceTo" type="number" value={formData.priceTo} onChange={onFieldChange} /></div>
                </div>
                
                <div className="field">
                  <label>Video giới thiệu (Youtube/TikTok URL)</label>
                  <input name="videoUrl" value={formData.videoUrl} onChange={onFieldChange} placeholder="https://..." />
                </div>

                <div className="field">
                  <label>Danh sách nhiều ảnh (URLs, ngăn cách bằng dấu phẩy)</label>
                  <textarea 
                    name="images" 
                    value={Array.isArray(formData.images) ? formData.images.join(', ') : formData.images} 
                    onChange={onFieldChange} 
                    placeholder="URL1, URL2, URL3..."
                    rows="2"
                    style={{ width: '100%', background: 'var(--biz-surface-light)', color: 'white', border: '1px solid var(--biz-border)', borderRadius: '12px', padding: '0.8rem 1rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="field-row three-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="field"><label>Giờ mở</label><input name="openTime" type="time" value={formData.openTime} onChange={onFieldChange} /></div>
                  <div className="field"><label>Giờ đóng</label><input name="closeTime" type="time" value={formData.closeTime} onChange={onFieldChange} /></div>
                  <div className="field"><label>Ngày hoạt động</label><input name="openDays" placeholder="T2-CN" value={formData.openDays} onChange={onFieldChange} /></div>
                </div>
                <div className="field-row two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="field"><label>Điện thoại *</label><input required name="contactPhone" value={formData.contactPhone} onChange={onFieldChange} /></div>
                  <div className="field"><label>Email *</label><input required type="email" name="contactEmail" value={formData.contactEmail} onChange={onFieldChange} /></div>
                </div>
                <div className="field"><label>Website</label><input name="website" value={formData.website} onChange={onFieldChange} /></div>

                <div className="field">
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Tiện ích</label>
                  <div className="amenities" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                      { value: 'wifi', label: 'Wi-Fi' },
                      { value: 'parking', label: 'Bãi đỗ xe' },
                      { value: 'pool', label: 'Hồ bơi' },
                      { value: 'guide', label: 'Hướng dẫn viên' },
                      { value: 'ticket', label: 'Đặt vé' },
                      { value: 'restaurant', label: 'Nhà hàng' }
                    ].map((amenity) => (
                      <label key={amenity.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.amenities?.includes(amenity.value) || false}
                          value={amenity.value}
                          onChange={onAmenityChange}
                          style={{ width: 'auto' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{amenity.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label>Ảnh đại diện (Tải lên file)</label>
                  <input type="file" accept="image/*" onChange={onImageChange} style={{ padding: '0.5rem' }} />
                  {formData.image && <img className="image-preview" src={formData.image} alt="preview" style={{ marginTop: '1rem', width: '200px', borderRadius: '12px', objectFit: 'cover' }} />}
                </div>

                <div className="biz-modal-footer" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--biz-border)', paddingTop: '1.5rem' }}>
                  <button type="button" className="btn-biz btn-biz--ghost" onClick={() => setIsModalOpen(false)}>Hủy</button>
                  <button type="submit" className="btn-biz btn-biz--primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Đang xử lý...' : 'Lưu dịch vụ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
