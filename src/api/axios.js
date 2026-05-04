import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Thêm token vào header trước khi gọi API
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Bắt lỗi 401 Unauthorized nếu token hết hạn hoặc sai
api.interceptors.response.use(
    (response) => {
        // Trả về data luôn để clean code khi gọi API
        return response.data;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            alert('Lỗi: Bạn cần đăng nhập để thực hiện chức năng này!');
            localStorage.removeItem('token');
            // Redirect về trang login (Tuỳ chỉnh URL theo dự án của bạn)
            window.location.href = '/dashboard.html'; 
        }
        return Promise.reject(error.response ? error.response.data : error);
    }
);

export default api;
