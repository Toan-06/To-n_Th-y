import React, { useState } from 'react';
import './business-design.css';
import { authService } from './authService';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ name: '', email: '', password: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    if (!formData.email) return 'Vui lòng nhập email.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return 'Email không đúng định dạng.';
    if (!formData.password) return 'Vui lòng nhập mật khẩu.';
    if (formData.password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
    if (!isLogin && !formData.name) return 'Vui lòng nhập tên doanh nghiệp.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const data = isLogin 
        ? await authService.login(formData.email, formData.password)
        : await authService.register(formData.name, formData.email, formData.password);

      if (data.success) {
        if (rememberMe) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('biz_token', data.token); // Keep for backward compatibility
        } else {
          sessionStorage.setItem('token', data.token);
          sessionStorage.setItem('biz_token', data.token);
        }
        onLoginSuccess(data.user);
      } else {
        setError(data.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } catch (err) {
      setError('Không thể kết nối đến máy chủ. Kiểm tra lại mạng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="biz-auth-wrapper">
      <div className="biz-auth-container">
        <div className="biz-auth-header">
          <div className="logo" style={{ justifyContent: 'center', marginBottom: '1rem', fontSize: '1.8rem' }}>
            <span className="logo-mark">◈</span>
            WanderViệt Doanh nghiệp
          </div>
          <p className="auth-subtitle">
            {isLogin 
              ? 'Đăng nhập để quản lý dịch vụ và kết nối với khách hàng.' 
              : 'Đăng ký tài khoản để bắt đầu kinh doanh trên hệ sinh thái WanderViệt.'}
          </p>
        </div>

        {error && <div className="auth-error animate-fade">{error}</div>}

        <form onSubmit={handleSubmit} className="biz-auth-form" noValidate>
          {!isLogin && (
            <div className="field animate-slide">
              <label>Tên doanh nghiệp</label>
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="VD: Khách sạn Mường Thanh" 
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="admin@company.com" 
            />
          </div>
          <div className="field">
            <label>Mật khẩu</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleChange} 
              placeholder="••••••••" 
            />
          </div>

          {isLogin && (
            <div className="field-row animate-slide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', marginTop: '-0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal', color: 'var(--biz-text-muted)' }}>
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)} 
                  style={{ width: 'auto', padding: 0 }}
                />
                Ghi nhớ đăng nhập
              </label>
              <button type="button" className="auth-link-btn" onClick={() => alert('Tính năng khôi phục mật khẩu đang được phát triển!')}>
                Quên mật khẩu?
              </button>
            </div>
          )}

          <button type="submit" className="btn-biz btn-biz--primary auth-submit-btn" disabled={loading}>
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản')}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <p>Chưa có tài khoản? <button className="auth-link-btn" onClick={toggleMode}>Đăng ký ngay</button></p>
          ) : (
            <p>Đã có tài khoản? <button className="auth-link-btn" onClick={toggleMode}>Đăng nhập</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
