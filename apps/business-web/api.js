/**
 * api.js — Global API Client (Axios-based)
 * Loaded BEFORE all other modules in index.html
 *
 * Hỗ trợ TẤT CẢ key token có thể được lưu bởi các module khác nhau:
 *   - biz_auth_token   (dashboard.html)
 *   - wander_business_token (biz-extend.js)
 *   - biz_token        (Auth.jsx)
 *   - token            (authService.js mới)
 */

(function setupApi() {
    // ── Đọc token từ TẤT CẢ vị trí có thể ───────────────────────
    function _getToken() {
        return localStorage.getItem('biz_auth_token') ||
               localStorage.getItem('wander_business_token') ||
               localStorage.getItem('biz_token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('biz_auth_token') ||
               sessionStorage.getItem('wander_business_token') ||
               sessionStorage.getItem('biz_token') ||
               sessionStorage.getItem('token') ||
               null;
    }

    // ── Tạo Axios instance ────────────────────────────────────────
    window.api = axios.create({
        baseURL: '/api',
        timeout: 12000,
        headers: { 'Content-Type': 'application/json' }
    });

    // ── REQUEST: gắn token vào header ────────────────────────────
    window.api.interceptors.request.use(
        function(config) {
            const token = _getToken();
            if (token) {
                config.headers.Authorization = 'Bearer ' + token;
            }
            return config;
        },
        function(error) { return Promise.reject(error); }
    );

    // ── RESPONSE: unwrap data, xử lý lỗi ─────────────────────────
    window.api.interceptors.response.use(
        function(response) {
            return response.data;
        },
        function(error) {
            const status = error.response ? error.response.status : null;
            const msg    = error.response && error.response.data ? error.response.data.message : 'Lỗi kết nối máy chủ';

            if (status === 401) {
                // KHÔNG dùng alert() và KHÔNG redirect tự động
                // Chỉ log để debug. Từng module tự hiển thị lỗi inline.
                console.warn('[API 401] ' + msg);
            }

            return Promise.reject({ status, message: msg });
        }
    );

    // ── Helpers toàn cục ─────────────────────────────────────────
    window.getAuthToken = _getToken;

    window.isLoggedIn = function() {
        return !!_getToken();
    };

    console.log('[api.js] ✅ Khởi tạo OK — token hiện tại:', _getToken() ? 'CÓ ✓' : 'KHÔNG');
})();
