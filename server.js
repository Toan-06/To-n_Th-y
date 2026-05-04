require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const http = require('http');
const { initBroadcastWorker } = require('./utils/broadcastWorker');

// Clean up environment variables (remove spaces/newlines)
if (process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = process.env.GROQ_API_KEY.trim();
if (process.env.GROQ_API_KEY_PLANNER) process.env.GROQ_API_KEY_PLANNER = process.env.GROQ_API_KEY_PLANNER.trim();
if (process.env.GROQ_API_KEY_NAVIGATION) process.env.GROQ_API_KEY_NAVIGATION = process.env.GROQ_API_KEY_NAVIGATION.trim();
if (process.env.JWT_SECRET) process.env.JWT_SECRET = process.env.JWT_SECRET.trim();
if (process.env.MONGODB_URI) process.env.MONGODB_URI = process.env.MONGODB_URI.trim();

const PORT = 3000;
const app = express();
app.set('trust proxy', true);

app.use(compression()); // Bật nén dữ liệu
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Force no-cache to fix browser caching old JS files
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// API Routes
app.use('/api/chat', require('./routes/chat'));
app.use('/api/places', require('./routes/places'));
app.use('/api/auth', require('./routes/auth').router);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/business', require('./routes/business'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/planner', require('./routes/planner'));
app.use('/api/directions', require('./routes/directions'));
app.use('/api/navi', require('./routes/ai-navigation'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/social', require('./routes/social'));
app.use('/api/public', require('./routes/public'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));

// Static User Web
app.use(express.static(path.join(__dirname, 'apps/user-web')));
app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ success: false });
    res.sendFile(path.join(__dirname, 'apps/user-web/index.html'));
});

// Proxy logic
function makeProxy(targetPort) {
    return (req, res) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            const pr = http.request({
                hostname: '127.0.0.1', port: targetPort, path: req.url, method: req.method,
                headers: { ...req.headers, host: `127.0.0.1:${targetPort}`, 'content-length': body.length }
            }, upstream => {
                res.writeHead(upstream.statusCode, upstream.headers);
                upstream.pipe(res, { end: true });
            });
            pr.on('error', () => { if (!res.headersSent) res.status(502).json({ success: false }); });
            pr.end(body);
        });
    };
}

// Start Portals
const startPortals = () => {
    const proxy = makeProxy(PORT);
    [{ p: 3001, d: 'apps/admin-web' }, { p: 3002, d: 'apps/business-web' }].forEach(config => {
        const pApp = express();
        pApp.use(cors({ origin: true, credentials: true }));
        
        // Fix cache issues
        pApp.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            next();
        });

        pApp.use('/api/', (req, res) => { req.url = '/api/' + req.url.replace(/^\//, ''); proxy(req, res); });
        pApp.use('/uploads/', (req, res) => { req.url = '/uploads/' + req.url.replace(/^\//, ''); proxy(req, res); });
        pApp.use(express.static(path.join(__dirname, config.d)));
        pApp.use((req, res) => res.sendFile(path.join(__dirname, config.d, 'index.html')));
        pApp.listen(config.p).on('error', () => {});
    });
};

// Database & Start
mongoose.connect(process.env.MONGODB_URI.trim())
    .then(() => {
        console.log('👤 Web Người Dùng:   http://localhost:3000');
        console.log('🛡️ Web Quản Trị:     http://localhost:3001');
        console.log('💼 Web Doanh Nghiệp: http://localhost:3002');
        console.log('✅ MongoDB connected');
        
        app.listen(PORT, '0.0.0.0', () => {
            startPortals();
            initBroadcastWorker(); // Khởi chạy trình gửi thông báo tự động
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ LỖI: Cổng ${PORT} đang bị chiếm dụng!`);
                console.error('Vui lòng tắt các tiến trình Node.js đang chạy ngầm rồi thử lại.');
                process.exit(1);
            }
            console.error('Server error:', err);
        });
    })
    .catch((err) => {
        console.error('MongoDB error:', err);
    });
