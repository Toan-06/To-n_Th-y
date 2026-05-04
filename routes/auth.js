const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminAccount = require('../models/AdminAccount');
const BusinessAccount = require('../models/BusinessAccount');
const logAction = require('../utils/logger');
const { calculateRank } = require('../utils/rankUtils');
const Itinerary = require('../models/Itinerary');
const Conversation = require('../models/Conversation');
const Place = require('../models/Place');

const JWT_SECRET = (process.env.JWT_SECRET || 'wander-viet-secret-key-123').trim();
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@wanderviet.com';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'password@2006';

const signPortalToken = (account, portal, role) => {
  const accountId = account.customId || account.id || account._id.toString();
  const payload = {
    id: accountId,
    email: account.email,
    name: account.name,
    displayName: account.displayName || account.name,
    role,
    status: account.status || 'active',
    portal
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

const generateCustomId = (roleOrKind) => {
  let prefix = 'user';
  if (roleOrKind === 'business') prefix = 'business';
  else if (roleOrKind === 'admin' || roleOrKind === 'superadmin') prefix = 'admin';
  else if (roleOrKind === 'diem-du-lich' || roleOrKind === 'tour') prefix = 'tour';
  else if (roleOrKind === 'tien-ich' || roleOrKind === 'service') prefix = 'service';
  
  const randomNum = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${randomNum}`;
};

const verifyPortalToken = (expectedPortal) => async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token || token === 'null' || token === 'undefined') {
    if (expectedPortal === null) return next(); 
    return res.status(401).json({ success: false, message: 'Không có token, từ chối quyền truy cập' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Flexible account extraction
    const account = decoded.account || decoded.user || (decoded.id ? decoded : null);
    if (!account) return res.status(401).json({ success: false, message: 'Auth: Invalid token structure' });
    
    const accountId = account.id || account._id || account.customId;
    if (!account || !accountId) return res.status(401).json({ success: false, message: 'Auth: Token missing account ID' });
    
    // Standardize portal
    if (!account.portal) {
      if (decoded.role === 'admin' || decoded.role === 'superadmin') account.portal = 'admin';
      else if (decoded.portal) account.portal = decoded.portal;
      else account.portal = expectedPortal || 'user';
    }
    
    account.id = accountId; 
    
    const isPortalCheckRequired = expectedPortal && expectedPortal !== null && expectedPortal !== 'null';
    if (isPortalCheckRequired && account.portal !== expectedPortal) {
      return res.status(403).json({ success: false, message: `Auth: Portal mismatch (Expected ${expectedPortal}, got ${account.portal})` });
    }

    const modelMap = { 'user': User, 'business': BusinessAccount, 'admin': AdminAccount };
    const Model = modelMap[account.portal || expectedPortal];
    
    if (Model) {
      const query = {
        $or: [
          { customId: accountId },
          { id: accountId }
        ]
      };
      if (mongoose.Types.ObjectId.isValid(accountId)) {
        query.$or.push({ _id: accountId });
      }

      const accountData = await Model.findOne(query);
      if (!accountData) {
        console.warn(`Auth: Account ${accountId} not found in ${account.portal || expectedPortal}`);
        return res.status(401).json({ success: false, message: 'Auth: Account not found in DB' });
      }
      
      const now = new Date();
      const lastActive = accountData.lastActive || new Date(0);
      if (now - lastActive > 5 * 60 * 1000) {
        accountData.lastActive = now;
        await accountData.save();
      }

      if (accountData.status === 'suspended') return res.status(403).json({ success: false, message: 'Auth: Account suspended' });
      
      req.user = {
        id: accountData.customId || accountData.id || accountData._id.toString(),
        email: accountData.email,
        role: accountData.role || (account.portal === 'admin' ? 'admin' : account.portal),
        status: accountData.status,
        displayName: accountData.displayName || accountData.name,
        name: accountData.name,
        portal: account.portal || expectedPortal
      };
    } else {
      req.user = {
        id: accountId,
        email: account.email,
        role: account.role,
        status: account.status,
        displayName: account.displayName || account.name,
        name: account.name,
        portal: account.portal
      };
    }
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' && err.message === 'invalid signature') {
      console.warn(`[Auth] Signature mismatch from ${req.ip}. Cleared stale token on server.`);
    } else {
      console.error('JWT Verification Error:', err.message);
    }
    return res.status(401).json({ success: false, message: 'Auth: JWT verification failed', error: err.message });
  }
};

const auth = verifyPortalToken('user');
const businessAuth = verifyPortalToken('business');
const adminTokenAuth = verifyPortalToken('admin');
const sharedAuth = verifyPortalToken(null);

async function ensureDefaultAdmin() {
  await AdminAccount.deleteMany({ email: 'root@wanderviet.com' });
  await AdminAccount.updateMany(
    { email: { $ne: DEFAULT_ADMIN_EMAIL }, role: 'superadmin' },
    { $set: { role: 'admin' } }
  );
  let admin = await AdminAccount.findOne({ email: DEFAULT_ADMIN_EMAIL });
  const hashed = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  if (!admin) {
    admin = new AdminAccount({
      customId: generateCustomId('superadmin'),
      name: 'Super Admin',
      displayName: 'Super Admin',
      email: DEFAULT_ADMIN_EMAIL,
      password: hashed,
      role: 'superadmin',
      status: 'active'
    });
    await admin.save();
    return;
  }
  admin.password = hashed;
  admin.role = 'superadmin';
  admin.status = 'active';
  if (!admin.name) admin.name = 'Super Admin';
  if (!admin.displayName) admin.displayName = 'Super Admin';
  await admin.save();
}

// USER portal: đăng ký
router.post('/user/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
    user = new User({
      customId: generateCustomId('user'),
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      displayName: name,
      role: 'user',
      status: 'active'
    });
    await user.save();
    const token = signPortalToken(user, 'user', 'user');
    await logAction(user.email, 'user', 'USER_REGISTER', { user: { id: user.id, email: user.email, displayName: user.name, role: user.role } }, req.ip, req.headers['user-agent']);
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: 'user', avatar: user.avatar, status: user.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// USER portal: đăng nhập
router.post('/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase(), role: 'user' });
    if (!user) return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    if (user.status === 'suspended') return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    const token = signPortalToken(user, 'user', 'user');
    await logAction(user.email, 'user', 'USER_LOGIN', { user: { id: user.id, email: user.email, displayName: user.displayName || user.name, role: user.role } }, req.ip, req.headers['user-agent']);
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: 'user', avatar: user.avatar, status: user.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user/me', auth, async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Lấy thông tin rank của user (Unified endpoint)
router.get('/user/rank', auth, async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found for rank' });
    
    // Ensure rank info exists
    const rankInfo = calculateRank(user.points || 0);
    
    res.json({
      success: true,
      points: user.points || 0,
      rank: user.rank || rankInfo.rank,
      rankTier: user.rankTier || rankInfo.tier,
      nextThreshold: rankInfo.nextThreshold || null,
      claimedQuests: user.claimedQuests || [],
      avatar: user.avatar || '',
      displayName: user.displayName || user.name || 'Thành viên',
      name: user.name || '',
      email: user.email || '',
      customId: user.customId || user._id.toString()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Lấy log hoạt động (để tính toán quest)
router.get('/user/activity', auth, async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, activityLog: user.activityLog || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cộng XP cho user (Duplicate logic removed, use the one at the end of file)


// BUSINESS portal: đăng ký/đăng nhập/me
router.post('/business/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase();
    // Bỏ check trùng lặp để 1 email tạo nhiều tài khoản
    let account = new BusinessAccount({
      customId: generateCustomId('business'),
      name,
      displayName: name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      status: 'active'
    });
    await account.save();
    await logAction(account.email, 'business', 'BUSINESS_REGISTER', { email: account.email, id: account._id }, req.ip, req.headers['user-agent']);
    const token = signPortalToken(account, 'business', 'business');
    res.json({ success: true, token, user: { id: account.id, email: account.email, name: account.name, role: 'business', status: account.status, avatar: account.avatar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/business/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const accounts = await BusinessAccount.find({ email: String(email || '').toLowerCase() });
    if (!accounts || accounts.length === 0) return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    
    let matchedAccount = null;
    for (const acc of accounts) {
      const isMatch = await bcrypt.compare(password, acc.password);
      if (isMatch) {
        if (acc.status === 'suspended') {
          return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
        }
        matchedAccount = acc;
        break;
      }
    }
    
    if (!matchedAccount) return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    const token = signPortalToken(matchedAccount, 'business', 'business');
    await logAction(matchedAccount.email, 'business', 'BUSINESS_LOGIN', { email: matchedAccount.email, id: matchedAccount._id }, req.ip, req.headers['user-agent']);
    res.json({ success: true, token, user: { id: matchedAccount.id, email: matchedAccount.email, name: matchedAccount.name, role: 'business', status: matchedAccount.status, avatar: matchedAccount.avatar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/business/me', businessAuth, async (req, res) => {
  try {
    const account = await BusinessAccount.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    }).select('-password');
    if (!account) return res.status(404).json({ success: false, message: 'Tài khoản doanh nghiệp không tồn tại' });
    res.json({ success: true, user: { ...account.toObject(), role: 'business' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN portal: đăng ký/đăng nhập/me
router.post('/admin/register', async (_req, res) => {
  return res.status(403).json({ success: false, message: 'Vui lòng dùng chức năng tạo Admin từ dashboard Super Admin' });
});

router.post('/admin/create', adminTokenAuth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Chỉ Super Admin mới được tạo tài khoản admin mới' });
    }
    const { name, email, password, permissions } = req.body;
    const normalizedEmail = String(email || '').toLowerCase();
    let account = await AdminAccount.findOne({ email: normalizedEmail });
    if (account) return res.status(400).json({ success: false, message: 'Email admin đã tồn tại' });
    account = new AdminAccount({
      customId: generateCustomId('admin'),
      name,
      displayName: name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'admin',
      status: 'active',
      permissions: permissions || ['overview']
    });
    await account.save();
    await logAction(req.user.email, req.user.role, 'ADMIN_CREATED', { newAdminEmail: account.email }, req.ip, req.headers['user-agent']);
    res.json({ success: true, user: { id: account.id, email: account.email, name: account.name, role: account.role, status: account.status, avatar: account.avatar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/login', async (req, res) => {
  try {
    await ensureDefaultAdmin();
    const { email, password } = req.body;
    const account = await AdminAccount.findOne({ email: String(email || '').toLowerCase() });
    if (!account) return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    if (account.status === 'suspended') return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    const token = signPortalToken(account, 'admin', account.role);
    await logAction(account.email, account.role, 'ADMIN_LOGIN', { email: account.email, role: account.role }, req.ip, req.headers['user-agent']);
    res.json({ success: true, token, user: { id: account.id, email: account.email, name: account.name, role: account.role, status: account.status, avatar: account.avatar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Lấy danh sách toàn bộ Admin (cho Super Admin)
router.get('/admin/list', adminTokenAuth, async (req, res) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const admins = await AdminAccount.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/admin/me', adminTokenAuth, async (req, res) => {
  try {
    const account = await AdminAccount.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    }).select('-password');
    if (!account) return res.status(404).json({ success: false, message: 'Tài khoản admin không tồn tại' });
    res.json({ success: true, user: { ...account.toObject(), role: account.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Backward compatibility endpoints
router.post('/register', (req, res, next) => {
  req.url = '/user/register';
  next();
});
router.post('/login', (req, res, next) => {
  req.url = '/user/login';
  next();
});
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    
    // Đảm bảo các trường rank có giá trị mặc định
    if (!user.rank) user.rank = 'Đồng';
    if (!user.rankTier) user.rankTier = 'I';
    if (!user.points) user.points = 0;
    
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cấu hình Rank/XP
const RANK_CONFIG = [
  { rank: 'Đồng', tier: 'I', min: 0 },
  { rank: 'Đồng', tier: 'II', min: 100 },
  { rank: 'Đồng', tier: 'III', min: 200 },
  { rank: 'Bạc', tier: 'I', min: 300 },
  { rank: 'Bạc', tier: 'II', min: 500 },
  { rank: 'Bạc', tier: 'III', min: 700 },
  { rank: 'Vàng', tier: 'I', min: 1000 },
  { rank: 'Vàng', tier: 'II', min: 1300 },
  { rank: 'Vàng', tier: 'III', min: 1600 },
  { rank: 'Bạch Kim', tier: 'I', min: 2000 },
  { rank: 'Bạch Kim', tier: 'II', min: 2400 },
  { rank: 'Bạch Kim', tier: 'III', min: 2800 },
  { rank: 'Kim Cương', tier: 'I', min: 3200 },
  { rank: 'Kim Cương', tier: 'II', min: 3700 },
  { rank: 'Kim Cương', tier: 'III', min: 4200 },
  { rank: 'Huyền Thoại', tier: '', min: 5000 }
];

function getRankDetails(points) {
  let current = RANK_CONFIG[0];
  let next = null;
  for (let i = 0; i < RANK_CONFIG.length; i++) {
    if (points >= RANK_CONFIG[i].min) {
      current = RANK_CONFIG[i];
      next = RANK_CONFIG[i+1] || null;
    } else {
      break;
    }
  }
  return { current, next };
}

// Legacy endpoint removed (Using unified one at line 200)

// Cộng XP và thăng hạng
router.post('/user/add-xp', auth, async (req, res) => {
  try {
    const { xp, questId, reason } = req.body;
    if (typeof xp !== 'number') return res.status(400).json({ success: false, message: 'XP invalid' });

    let user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Tránh cộng trùng quest
    if (questId && user.claimedQuests.includes(questId)) {
      return res.status(400).json({ success: false, message: 'Quest already claimed' });
    }

    user.points = (user.points || 0) + xp;
    if (questId) user.claimedQuests.push(questId);

    // Tính toán lại hạng
    const { current } = getRankDetails(user.points);
    user.rank = current.rank;
    user.rankTier = current.tier;

    await user.save();
    
    // Log hoạt động
    await logAction(user.email, user.role, 'USER_XP_ADDED', { xp, questId, reason, newPoints: user.points }, req.ip, req.headers['user-agent']);

    res.json({
      success: true,
      points: user.points,
      rank: user.rank,
      rankTier: user.rankTier,
      message: `Đã cộng ${xp} XP! Hạng hiện tại: ${user.rank} ${user.rankTier}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cập nhật hồ sơ user
router.put('/profile', auth, async (req, res) => {
  try {
    const { displayName, notes, avatar, phone, preferences } = req.body;
    
    let user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (displayName !== undefined) user.displayName = displayName;
    if (notes !== undefined) user.notes = notes;
    if (avatar !== undefined) user.avatar = avatar;
    if (phone !== undefined) user.phone = phone;
    if (preferences !== undefined) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();
    await logAction(user.email, user.role, 'USER_PROFILE_UPDATED', { changed: Object.keys(req.body) }, req.ip, req.headers['user-agent']);
    res.json({ success: true, user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Đổi mật khẩu user
router.put('/password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ mật khẩu' });
    }
    
    let user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch && oldPassword !== user.password) { // Dự phòng pass lưu md5/plain-text cũ
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không đúng' });
    }

    // Mã hóa và lưu mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    await logAction(user.email, user.role, 'USER_PASSWORD_CHANGED', {}, req.ip, req.headers['user-agent']);
    
    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Lấy bảng xếp hạng người dùng
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await User.find({ role: 'user' })
      .select('name displayName avatar points rank rankTier')
      .sort({ points: -1 })
      .limit(100);
    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải bảng xếp hạng' });
  }
});

// Thống kê hoạt động cá nhân chính xác
router.get('/user/stats', auth, async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const itineraries = await Itinerary.find({ userId: req.user.id, isDeleted: false });
    
    // Đếm tin nhắn chatbot (userId trong Conversation là string)
    const messageCount = await Conversation.countDocuments({ userId: req.user.id });

    // Phân bổ vùng miền từ hành trình
    const regionMap = {};
    itineraries.forEach(itin => {
      // Giả sử destination có dạng "Tên, Tỉnh" hoặc chỉ "Tên"
      const parts = itin.destination.split(',');
      const reg = parts[parts.length - 1].trim();
      regionMap[reg] = (regionMap[reg] || 0) + 1;
    });

    // Phân bổ trạng thái
    const statusMap = { planning: 0, completed: 0, missed: 0 };
    itineraries.forEach(itin => {
      if (statusMap.hasOwnProperty(itin.status)) {
        statusMap[itin.status]++;
      }
    });

    // Tần suất hoạt động (7 ngày gần nhất)
    const activityDays = [0, 0, 0, 0, 0, 0, 0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    itineraries.filter(i => i.createdAt >= weekAgo).forEach(i => {
      const day = (new Date(i.createdAt).getDay() + 6) % 7; // Chuyển sang 0=T2, 6=CN
      activityDays[day]++;
    });

    res.json({
      success: true,
      summary: {
        trips: itineraries.length,
        favorites: (user.favorites || []).length,
        messages: messageCount,
        exp: user.points || 0,
        rank: (user.rank || 'Khám phá') + ' ' + (user.rankTier || '')
      },
      charts: {
        activity: activityDays,
        regions: regionMap,
        status: statusMap,
        interests: user.preferences?.interests || [],
        radar: [
          70 + (itineraries.length * 5), // Khám phá
          60 + (user.points / 100),    // Kỹ năng
          50 + (messageCount / 10),    // AI
          80,                          // Dịch vụ
          90,                          // Bền bỉ
          50                           // Sở thích
        ].map(v => Math.min(v, 100))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Đồng bộ danh sách yêu thích
router.post('/user/sync-favorites', auth, async (req, res) => {
  try {
    const { favorites } = req.body; // Mảng các ID địa điểm mới
    if (!Array.isArray(favorites)) return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    
    const user = await User.findOne({
      $or: [
        { customId: req.user.id },
        { id: req.user.id },
        { _id: mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId() }
      ]
    });
    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    
    const oldFavs = user.favorites || [];
    const added = favorites.filter(x => !oldFavs.includes(x));
    const removed = oldFavs.filter(x => !favorites.includes(x));

    user.favorites = favorites;
    await user.save();

    // Cập nhật favoritesCount cho Place (không dùng await trong loop để nhanh hơn, hoặc dùng bulk write)
    if (added.length > 0) {
      await Place.updateMany({ id: { $in: added } }, { $inc: { favoritesCount: 1 } });
    }
    if (removed.length > 0) {
      await Place.updateMany({ id: { $in: removed } }, { $inc: { favoritesCount: -1 } });
      // Đảm bảo không âm
      await Place.updateMany({ id: { $in: removed }, favoritesCount: { $lt: 0 } }, { $set: { favoritesCount: 0 } });
    }

    res.json({ success: true, count: user.favorites.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// QUÊN MẬT KHẨU (Gửi Email)
const crypto = require('crypto');
const nodemailer = require('nodemailer');

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, portal } = req.body; // portal: 'user', 'business', 'admin'
    const Model = portal === 'business' ? BusinessAccount : (portal === 'admin' ? AdminAccount : User);
    
    const account = await Model.findOne({ email: String(email).toLowerCase() });
    if (!account) return res.status(404).json({ success: false, message: 'Email không tồn tại trong hệ thống' });

    // Tạo token
    const token = crypto.randomBytes(20).toString('hex');
    account.resetPasswordToken = token;
    account.resetPasswordExpires = Date.now() + 3600000; // 1 giờ
    await account.save();

    // Gửi email (Simulation/Real)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${token}&portal=${portal}`;
    const mailOptions = {
      to: account.email,
      from: process.env.EMAIL_USER,
      subject: 'Đặt lại mật khẩu WanderViệt',
      text: `Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.\n\n` +
            `Vui lòng nhấp vào liên kết sau hoặc dán vào trình duyệt của bạn để hoàn tất quá trình:\n\n` +
            `${resetUrl}\n\n` +
            `Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.\n`
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.' });
    } catch (mailErr) {
      console.error('Lỗi gửi mail:', mailErr);
      // Trả về token trong response để DEV có thể test nếu mail server chưa config xong
      res.json({ success: true, message: 'Email server đang bảo trì. Token test: ' + token, token });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ĐẶT LẠI MẬT KHẨU MỚI
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, portal } = req.body;
    const Model = portal === 'business' ? BusinessAccount : (portal === 'admin' ? AdminAccount : User);

    const account = await Model.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!account) return res.status(400).json({ success: false, message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });

    // Cập nhật mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    account.password = await bcrypt.hash(password, salt);
    account.resetPasswordToken = undefined;
    account.resetPasswordExpires = undefined;
    await account.save();

    res.json({ success: true, message: 'Mật khẩu của bạn đã được cập nhật thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, auth, businessAuth, adminTokenAuth, sharedAuth, verifyPortalToken, signPortalToken, generateCustomId };
