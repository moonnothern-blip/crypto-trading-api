const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ============ MONGODB CONNECTION ============
// Replace with your MongoDB connection string
const MONGODB_URI = 'mongodb+srv://moonnothern_db_user:Attention@cluster0.m94xnok.mongodb.net/crypto_trading?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected permanently');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// ============ MONGOOSE SCHEMAS ============

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  withdrawLimit: { type: Number, default: 1000 },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: true },
  twoFactorSecret: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false }
});

// Deposit Request Schema
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

// Withdrawal Request Schema
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

// Order Schema
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
  createdAt: { type: Date, default: Date.now }
});

// OTP Schema (temporary)
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now, expires: 300 }
});

// Create Models
const User = mongoose.model('User', userSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
const Order = mongoose.model('Order', orderSchema);
const OTP = mongoose.model('OTP', otpSchema);

// ============ INITIALIZE ADMIN (if not exists) ============
async function initAdmin() {
  const adminExists = await User.findOne({ email: 'admin@clutch.com' });
  if (!adminExists) {
    const admin = new User({
      email: 'admin@clutch.com',
      password: 'admin123',
      balance: 0,
      withdrawLimit: 0,
      isAdmin: true,
      isVerified: true
    });
    await admin.save();
    console.log('✅ Admin user created');
  }
}
initAdmin();

// ============ EMAIL CONFIGURATION ============
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'moonnothern@gmail.com', // CHANGE THIS
    pass: 'avjcqttllpnvrxqe' // CHANGE THIS - NO SPACES!
  }
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: '"Clutch Incorporated" <noreply@clutch.com>',
      to: to,
      subject: subject,
      html: html
    });
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
}

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

// ============ API ENDPOINTS ============

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  
  const existingUser = await User.findOne({ email, isDeleted: false });
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  
  const otp = generateOTP();
  
  await OTP.deleteMany({ email });
  await OTP.create({
    email,
    otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Clutch Incorporated</h2>
      <h3>Email Verification</h3>
      <p>Your OTP for registration is:</p>
      <h1 style="font-size: 48px; color: #e74c3c;">${otp}</h1>
      <p>Valid for 5 minutes.</p>
      <hr>
      <p style="color: #888;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  
  await sendEmail(email, 'Verify Your Email', html);
  res.json({ message: 'OTP sent to your email' });
});

// Verify OTP and Register
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp, password } = req.body;
  
  const otpRecord = await OTP.findOne({ email, otp });
  if (!otpRecord) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
  
  if (otpRecord.expiresAt < new Date()) {
    return res.status(400).json({ message: 'OTP expired' });
  }
  
  const newUser = new User({
    email,
    password,
    balance: 0,
    withdrawLimit: 1000,
    isAdmin: false
  });
  
  await newUser.save();
  await OTP.deleteMany({ email });
  
  const welcomeHtml = `<h2>Welcome to Clutch Incorporated!</h2><p>Your account has been created.</p>`;
  sendEmail(email, 'Welcome to Clutch', welcomeHtml);
  
  res.json({ 
    message: 'Registration successful', 
    token: newUser._id.toString(),
    user: { email, balance: 0, withdrawLimit: 1000 }
  });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email, password, isDeleted: false });
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  sendEmail(email, 'New Login Detected', `<p>Your account was logged into at ${new Date().toLocaleString()}</p>`);
  
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

// Get user info
app.get('/api/user-info', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  const user = await User.findById(token);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
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
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const newRequest = new DepositRequest({
    userId: user._id,
    userEmail: user.email,
    amount,
    walletType,
    status: 'pending'
  });
  
  await newRequest.save();
  
  res.json({ message: `Deposit request for $${amount} submitted.`, requestId: newRequest._id });
});

// Get user's deposit requests
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
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
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

// Get user's withdrawal requests
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
  
  res.json({
    users: users.map(u => ({
      id: u._id,
      email: u.email,
      balance: u.balance,
      withdrawLimit: u.withdrawLimit,
      createdAt: u.createdAt
    })),
    totalUsers: users.length,
    totalBalance: users.reduce((sum, u) => sum + u.balance, 0)
  });
});

// ============ ADMIN: Delete user (Soft delete - keeps data but marks deleted) ============
app.delete('/api/admin/delete-user/:userId', async (req, res) => {
  const { userId } = req.params;
  const adminToken = req.headers.authorization?.split(' ')[1];
  const admin = await User.findById(adminToken);
  
  if (!admin?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const userToDelete = await User.findById(userId);
  if (!userToDelete) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (userToDelete.isAdmin) {
    return res.status(400).json({ message: 'Cannot delete admin users' });
  }
  
  // Soft delete - mark as deleted but keep data
  userToDelete.isDeleted = true;
  userToDelete.deletedAt = new Date();
  await userToDelete.save();
  
  // Also mark all their requests as deleted (optional)
  await DepositRequest.updateMany({ userId: userId }, { status: 'deleted' });
  await WithdrawalRequest.updateMany({ userId: userId }, { status: 'deleted' });
  await Order.updateMany({ userId: userId }, { status: 'deleted' });
  
  // Send email notification
  const deleteHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #e74c3c;">Account Deleted</h2>
      <p>Your account has been deleted by admin.</p>
      <p>If you believe this is an error, please contact support.</p>
    </div>
  `;
  sendEmail(userToDelete.email, 'Account Deleted', deleteHtml);
  
  res.json({ message: `User ${userToDelete.email} has been deleted` });
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

// ============ PLACE ORDER ============
app.post('/api/place-order', async (req, res) => {
  const { symbol, type, side, amount, price, timeframe } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  if (side === 'buy') {
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
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
  
  res.json({ message: `Order placed for $${amount} at $${price}. Executes in ${timeframe} min.`, orderId: newOrder._id });
});

// Get open orders
app.get('/api/open-orders', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const orders = await Order.find({ userId: user._id, status: { $in: ['open', 'pending_execution'] } }).sort({ createdAt: -1 });
  res.json({ orders });
});

// Get order history
app.get('/api/order-history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const orders = await Order.find({ userId: user._id, status: { $nin: ['open', 'pending_execution'] } }).sort({ createdAt: -1 });
  res.json({ orders });
});

// Cancel order
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
    res.status(400).json({ message: 'Order cannot be cancelled' });
  }
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
  
  res.json({ message: `Order executed with ${profitPercentage}% profit. Profit: $${profit.toFixed(2)}` });
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

// Check expired timeframes
setInterval(async () => {
  const now = new Date();
  const orders = await Order.find({ status: 'open', timeframe: { $exists: true } });
  
  for (const order of orders) {
    const expiryTime = new Date(order.createdAt.getTime() + (order.timeframe * 60 * 1000));
    if (now >= expiryTime) {
      order.status = 'pending_execution';
      await order.save();
      console.log(`Order ${order._id} ready for execution`);
    }
  }
}, 30000);

// ============ Dashboard data ============
app.get('/api/dashboard', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await User.findById(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  res.json({ user: { email: user.email, balance: user.balance, withdrawLimit: user.withdrawLimit } });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});