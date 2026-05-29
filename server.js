const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ============ MONGODB CONNECTION ============
const MONGODB_URI = 'mongodb+srv://moonnothern_db_user:Attention@cluster0.m94xnok.mongodb.net/crypto_trading?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB error:', err);
});

// ============ MONGOOSE SCHEMAS ============

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  withdrawLimit: { type: Number, default: 1000 },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: true },
  isPaused: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  pauseReason: String,
  pausedAt: Date,
  resumedAt: Date,
  deletedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const depositRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  amount: Number,
  walletType: String,
  status: String,
  adminWallet: String,
  transactionId: String,
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now }
});

const withdrawalRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  amount: Number,
  walletAddress: String,
  walletType: String,
  status: String,
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  symbol: String,
  type: String,
  side: String,
  amount: Number,
  price: Number,
  filled: Number,
  status: String,
  timeframe: Number,
  profit: Number,
  profitPercentage: Number,
  rejectionReason: String,
  executedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
const Order = mongoose.model('Order', orderSchema);

// ============ EMAIL SETUP (for client notifications only) ============
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: 
    user: 'jkkevin00@gmail.com',
    pass: 'skazvhnapmomgdai'  // CHANGE THIS to your actual app password
  }
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: '"Clutch Incorporated" <jkkevin00@gmail.com>',
      to: to,
      subject: subject,
      html: html
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
}

// ============ INITIALIZE ADMIN ============
async function initAdmin() {
  const adminExists = await User.findOne({ email: 'jkkevin00@gmail.com' });
  if (!adminExists) {
    const admin = new User({
      email: 'jkkevin00@gmail.com',
      password: 'admin123',
      balance: 0,
      withdrawLimit: 0,
      isAdmin: true,
      isVerified: true
    });
    await admin.save();
    console.log('✅ Admin user created');
    console.log('   Email: jkkevin00@gmail.com');
    console.log('   Password: admin123');
  }
}
initAdmin();

// ============ HTML PAGES ============
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/trading', (req, res) => {
  res.sendFile(path.join(__dirname, 'trading.html'));
});

app.get('/wallet', (req, res) => {
  res.sendFile(path.join(__dirname, 'wallet.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============ 2FA FOR ADMIN LOGIN ============

// Generate 2FA secret (shows secret key)
app.get('/api/admin/setup-2fa', async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `ClutchAdmin:jkkevin00@gmail.com`
  });
  
  res.json({ 
    secret: secret.base32,
    message: 'Copy this secret key to Google Authenticator'
  });
});

// Save 2FA secret after admin adds to Google Authenticator
app.post('/api/admin/save-2fa-secret', async (req, res) => {
  const { email, secret } = req.body;
  
  const admin = await User.findOne({ email, isAdmin: true });
  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }
  
  admin.twoFactorSecret = secret;
  await admin.save();
  
  res.json({ message: '2FA enabled successfully' });
});

// Admin login with 2FA
app.post('/api/admin/login', async (req, res) => {
  const { email, password, twoFactorCode } = req.body;
  
  const admin = await User.findOne({ email, isAdmin: true });
  if (!admin) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }
  
  if (admin.password !== password) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }
  
  if (!admin.twoFactorSecret) {
    return res.status(401).json({ message: '2FA not set up' });
  }
  
  const verified = speakeasy.totp.verify({
    secret: admin.twoFactorSecret,
    encoding: 'base32',
    token: twoFactorCode,
    window: 1
  });
  
  if (!verified) {
    return res.status(401).json({ message: 'Invalid 2FA code' });
  }
  
  res.json({ 
    message: 'Login successful', 
    token: admin._id.toString(),
    user: { email: admin.email, isAdmin: true }
  });
});

// ============ CLIENT REGISTRATION (NO OTP) ============
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  const existingUser = await User.findOne({ email, isDeleted: false });
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  
  const newUser = new User({
    email,
    password,
    balance: 0,
    withdrawLimit: 1000,
    isAdmin: false
  });
  
  await newUser.save();
  
  const welcomeHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #e74c3c;">Welcome to Clutch Incorporated!</h2>
      <p>Your account has been created successfully.</p>
    </div>
  `;
  sendEmail(email, 'Welcome to Clutch Incorporated', welcomeHtml);
  
  res.json({ 
    message: 'Registration successful', 
    token: newUser._id.toString(),
    user: { email, balance: 0, withdrawLimit: 1000 }
  });
});

// ============ CLIENT LOGIN ============
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email, password, isDeleted: false });
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  if (user.isPaused) {
    return res.status(401).json({ message: 'Your account has been paused. Please contact support.' });
  }
  
  res.json({ 
    message: 'Login successful', 
    token: user._id.toString(),
    user: { 
      email: user.email, 
      balance: user.balance,
      withdrawLimit: user.withdrawLimit,
      isAdmin: user.isAdmin
    }
  });
});

// ============ GET USER INFO ============
app.get('/api/user-info', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  res.json({ 
    balance: user.balance,
    withdrawLimit: user.withdrawLimit,
    email: user.email
  });
});

// ============ DEPOSIT REQUEST ============
app.post('/api/request-deposit', async (req, res) => {
  const { amount, walletType } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const newRequest = new DepositRequest({
    userId: user._id,
    userEmail: user.email,
    amount,
    walletType,
    status: 'pending'
  });
  
  await newRequest.save();
  res.json({ message: `Deposit request for $${amount} submitted.` });
});

app.get('/api/my-deposit-requests', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const requests = await DepositRequest.find({ userId: user._id }).sort({ createdAt: -1 });
  res.json({ requests });
});

// ============ WITHDRAWAL REQUEST ============
app.post('/api/request-withdraw', async (req, res) => {
  const { amount, walletAddress, walletType } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  if (amount > user.withdrawLimit) {
    return res.status(400).json({ message: `Limit is $${user.withdrawLimit}` });
  }
  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  
  const newRequest = new WithdrawalRequest({
    userId: user._id,
    userEmail: user.email,
    amount,
    walletAddress,
    walletType,
    status: 'pending'
  });
  
  await newRequest.save();
  res.json({ message: `Withdrawal request for $${amount} submitted.` });
});

app.get('/api/my-withdrawal-requests', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const requests = await WithdrawalRequest.find({ userId: user._id }).sort({ createdAt: -1 });
  res.json({ requests });
});

// ============ ADMIN: Get all deposit requests ============
app.get('/api/admin/deposit-requests', async (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const requests = await DepositRequest.find().sort({ createdAt: -1 });
  res.json({ requests });
});

// ============ ADMIN: Provide wallet address ============
app.post('/api/admin/provide-wallet', async (req, res) => {
  const { requestId, walletAddress } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const request = await DepositRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  request.adminWallet = walletAddress;
  request.status = 'waiting_payment';
  await request.save();
  
  res.json({ message: 'Wallet address provided' });
});

// ============ ADMIN: Confirm deposit ============
app.post('/api/admin/confirm-deposit', async (req, res) => {
  const { requestId } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const request = await DepositRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  const user = await User.findById(request.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  user.balance += request.amount;
  await user.save();
  
  request.status = 'completed';
  await request.save();
  
  res.json({ message: `Deposit confirmed. New balance: $${user.balance}` });
});

// ============ ADMIN: Reject deposit ============
app.post('/api/admin/reject-deposit', async (req, res) => {
  const { requestId, reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const request = await DepositRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  request.status = 'rejected';
  request.rejectionReason = reason;
  await request.save();
  
  res.json({ message: 'Deposit request rejected' });
});

// ============ ADMIN: Get all withdrawal requests ============
app.get('/api/admin/withdrawal-requests', async (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const requests = await WithdrawalRequest.find().sort({ createdAt: -1 });
  res.json({ requests });
});

// ============ ADMIN: Approve withdrawal ============
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { requestId } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const request = await WithdrawalRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  const user = await User.findById(request.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  if (user.balance < request.amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  
  user.balance -= request.amount;
  await user.save();
  
  request.status = 'approved';
  await request.save();
  
  res.json({ message: `Withdrawal approved. New balance: $${user.balance}` });
});

// ============ ADMIN: Reject withdrawal ============
app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { requestId, reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const request = await WithdrawalRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  request.status = 'rejected';
  request.rejectionReason = reason;
  await request.save();
  
  res.json({ message: 'Withdrawal request rejected' });
});

// ============ ADMIN: Get all users ============
app.get('/api/admin/users', async (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const users = await User.find({ isAdmin: false, isDeleted: false }).sort({ createdAt: -1 });
  const pausedUsers = users.filter(u => u.isPaused === true).length;
  
  res.json({
    users: users.map(u => ({
      id: u._id,
      email: u.email,
      balance: u.balance,
      withdrawLimit: u.withdrawLimit,
      isPaused: u.isPaused || false,
      createdAt: u.createdAt
    })),
    totalUsers: users.length,
    totalBalance: users.reduce((sum, u) => sum + u.balance, 0),
    pausedUsers: pausedUsers
  });
});

// ============ ADMIN: Update withdrawal limit ============
app.post('/api/admin/update-limit', async (req, res) => {
  const { userId, newLimit } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  user.withdrawLimit = newLimit;
  await user.save();
  
  res.json({ message: `Withdrawal limit updated to $${newLimit}` });
});

// ============ ADMIN: Delete user ============
app.delete('/api/admin/delete-user/:userId', async (req, res) => {
  const { userId } = req.params;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ message: 'Cannot delete admin' });
  
  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();
  
  res.json({ message: `User ${user.email} has been deleted` });
});

// ============ ADMIN: Pause user ============
app.post('/api/admin/pause-user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isAdmin) return res.status(400).json({ message: 'Cannot pause admin' });
  
  user.isPaused = true;
  user.pauseReason = reason;
  user.pausedAt = new Date();
  await user.save();
  
  res.json({ message: `User ${user.email} has been paused` });
});

// ============ ADMIN: Resume user ============
app.post('/api/admin/resume-user/:userId', async (req, res) => {
  const { userId } = req.params;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  user.isPaused = false;
  user.pauseReason = null;
  user.resumedAt = new Date();
  await user.save();
  
  res.json({ message: `User ${user.email} has been resumed` });
});

// ============ ADMIN: Get pending executions ============
app.get('/api/admin/pending-executions', async (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const orders = await Order.find({ status: 'pending_execution' }).sort({ createdAt: -1 });
  res.json({ orders });
});

// ============ ADMIN: Approve execution ============
app.post('/api/admin/approve-execution', async (req, res) => {
  const { orderId, profitPercentage } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  
  const user = await User.findById(order.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  const profit = (order.amount * parseFloat(profitPercentage)) / 100;
  user.balance += profit;
  await user.save();
  
  order.status = 'executed';
  order.profit = profit;
  order.profitPercentage = profitPercentage;
  order.executedAt = new Date();
  await order.save();
  
  res.json({ message: `Executed with ${profitPercentage}% profit. Profit: $${profit.toFixed(2)}` });
});

// ============ ADMIN: Reject execution ============
app.post('/api/admin/reject-execution', async (req, res) => {
  const { orderId, reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  if (!admin?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  
  if (order.side === 'buy') {
    const user = await User.findById(order.userId);
    if (user) {
      user.balance += order.amount;
      await user.save();
    }
  }
  
  order.status = 'rejected';
  order.rejectionReason = reason;
  await order.save();
  
  res.json({ message: 'Order rejected and refunded' });
});

// ============ TRADING ============
app.post('/api/place-order', async (req, res) => {
  const { symbol, type, side, amount, price, timeframe } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  if (side === 'buy') {
    if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
    user.balance -= amount;
    await user.save();
  }
  
  const newOrder = new Order({
    userId: user._id,
    userEmail: user.email,
    symbol,
    type,
    side,
    amount,
    price,
    filled: 0,
    status: 'open',
    timeframe: timeframe || 60
  });
  
  await newOrder.save();
  res.json({ message: `Order placed. Executes in ${timeframe} min.`, orderId: newOrder._id });
});

app.get('/api/open-orders', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const orders = await Order.find({ userId: user._id, status: { $in: ['open', 'pending_execution'] } }).sort({ createdAt: -1 });
  res.json({ orders });
});

app.get('/api/order-history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const orders = await Order.find({ userId: user._id, status: { $nin: ['open', 'pending_execution'] } }).sort({ createdAt: -1 });
  res.json({ orders });
});

app.delete('/api/cancel-order/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const order = await Order.findOne({ _id: orderId, userId: user._id });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  
  if (order.status === 'open') {
    if (order.side === 'buy') {
      user.balance += order.amount;
      await user.save();
    }
    order.status = 'cancelled';
    await order.save();
    res.json({ message: 'Order cancelled', newBalance: user.balance });
  } else {
    res.status(400).json({ message: 'Cannot cancel' });
  }
});

// ============ DASHBOARD ============
app.get('/api/dashboard', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  res.json({ user: { email: user.email, balance: user.balance, withdrawLimit: user.withdrawLimit } });
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ============ CHECK EXPIRED TIMEFRAMES ============
setInterval(async () => {
  const now = new Date();
  const orders = await Order.find({ status: 'open', timeframe: { $exists: true } });
  for (const order of orders) {
    const expiry = new Date(order.createdAt.getTime() + (order.timeframe * 60 * 1000));
    if (now >= expiry) {
      order.status = 'pending_execution';
      await order.save();
      console.log(`Order ${order._id} ready for admin execution`);
    }
  }
}, 30000);

// ============ START SERVER ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🗄️ MongoDB: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
  console.log(`👨‍💼 Admin email: jkkevin00@gmail.com`);
  console.log(`🔑 Admin password: admin123`);
});