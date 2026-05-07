// Dịch vụ xác thực gọi API thật tới Node.js Backend

const API_URL = '/api/auth';

export const authService = {
  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          token: data.token,
          user: data.user
        };
      } else {
        return {
          success: false,
          message: data.message || 'Email hoặc mật khẩu không chính xác.'
        };
      }
    } catch (err) {
      return { success: false, message: 'Lỗi kết nối máy chủ.' };
    }
  },

  async register(name, email, password) {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'business' })
      });
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          token: data.token,
          user: data.user
        };
      } else {
        return {
          success: false,
          message: data.message || 'Đăng ký thất bại.'
        };
      }
    } catch (err) {
      return { success: false, message: 'Lỗi kết nối máy chủ.' };
    }
  },

  async checkAuth(token) {
    // Với hệ thống mới, backend middleware sẽ check token khi gọi các request data.
    // Nếu vẫn muốn verify cứng ở frontend, có thể gọi 1 route /me
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok) {
        return { success: true, user: data.data };
      } else {
        return { success: false };
      }
    } catch (err) {
      return { success: false };
    }
  }
};
