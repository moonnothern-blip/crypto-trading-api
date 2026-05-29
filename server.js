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

const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now, expires: 300 }
});

const User = mongoose.model('User', userSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
const Order = mongoose.model('Order', orderSchema);
const OTP = mongoose.model('OTP', otpSchema);

// ============ EMAIL SETUP ============
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'jkkevin00@gmail.com',  // YOUR EMAIL
    pass: 'skazvhnapmomgdai'       // YOUR APP PASSWORD (no spaces)
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

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============ INITIALIZE ADMIN (YOUR EMAIL) ============
async function initAdmin() {
  const adminEmail = 'jkkevin00@gmail.com';  // YOUR EMAIL
  
  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    const admin = new User({
      email: adminEmail,
      password: 'admin123',
      balance: 0,
      withdrawLimit: 0,
      isAdmin: true,
      isVerified: true
    });
    await admin.save();
    console.log('✅ Admin user created');
    console.log(`   Email: ${adminEmail}`);
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Welcome to Clutch Incorporated!</h2>
      <p>Your account has been created successfully.</p>
      <p>You can now:</p>
      <ul>
        <li>Request deposits to your preferred wallet</li>
        <li>Start trading with live market prices</li>
        <li>Request withdrawals to your wallet</li>
      </ul>
      <hr>
      <p style="color: #888;">Clutch Incorporated - Crypto Trading Platform</p>
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
  
  const loginHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">New Login Detected</h2>
      <p>Your account was just logged into at ${new Date().toLocaleString()}</p>
      <p>If this wasn't you, please contact support immediately.</p>
      <hr>
      <p style="color: #888;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(email, 'New Login to Your Account', loginHtml);
  
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

// ============ SEND OTP FOR ADMIN LOGIN ============
app.post('/api/admin/send-otp', async (req, res) => {
  const { email } = req.body;
  
  const admin = await User.findOne({ email, isAdmin: true });
  if (!admin) {
    return res.status(401).json({ message: 'Invalid admin email' });
  }
  
  const otp = generateOTP();
  
  await OTP.deleteMany({ email });
  await OTP.create({
    email,
    otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });
  
  const otpHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Clutch Incorporated</h2>
      <h3>Admin Login OTP</h3>
      <p>Your One-Time Password for admin login is:</p>
      <h1 style="font-size: 48px; color: #e74c3c; letter-spacing: 5px;">${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
      <p>Never share this code with anyone.</p>
      <hr>
      <p style="color: #888;">Clutch Incorporated - Admin Portal</p>
    </div>
  `;
  
  await sendEmail(email, 'Admin Login OTP', otpHtml);
  res.json({ message: 'OTP sent to your email' });
});

// ============ VERIFY OTP FOR ADMIN LOGIN ============
app.post('/api/admin/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  const otpRecord = await OTP.findOne({ email, otp });
  if (!otpRecord) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
  
  if (otpRecord.expiresAt < new Date()) {
    await OTP.deleteMany({ email });
    return res.status(400).json({ message: 'OTP expired' });
  }
  
  const admin = await User.findOne({ email, isAdmin: true });
  if (!admin) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  await OTP.deleteMany({ email });
  
  res.json({ 
    message: 'OTP verified', 
    token: admin._id.toString(),
    user: { email: admin.email, isAdmin: true }
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
  
  const adminHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #e74c3c;">New Deposit Request</h2>
      <p><strong>User:</strong> ${user.email}</p>
      <p><strong>Amount:</strong> $${amount}</p>
      <p><strong>Wallet Type:</strong> ${walletType}</p>
    </div>
  `;
  sendEmail('jkkevin00@gmail.com', 'New Deposit Request', adminHtml);
  
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
  
  const adminHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #e74c3c;">New Withdrawal Request</h2>
      <p><strong>User:</strong> ${user.email}</p>
      <p><strong>Amount:</strong> $${amount}</p>
      <p><strong>Wallet Type:</strong> ${walletType}</p>
      <p><strong>Address:</strong> ${walletAddress}</p>
    </div>
  `;
  sendEmail('jkkevin00@gmail.com', 'New Withdrawal Request', adminHtml);
  
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
  
  const user = await User.findById(request.userId);
  if (user) {
    const clientHtml = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #e74c3c;">Deposit Wallet Address Ready</h2>
        <p>Please send funds to:</p>
        <div style="background:#f0f0f0;padding:15px;border-radius:8px;font-family:monospace;">${walletAddress}</div>
        <p><strong>Amount:</strong> $${request.amount}</p>
        <p><strong>Wallet Type:</strong> ${request.walletType}</p>
        <p>After sending, click "I Have Sent the Payment" in your wallet page.</p>
      </div>
    `;
    sendEmail(user.email, 'Deposit Wallet Address Ready', clientHtml);
  }
  
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
  
  const clientHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #28a745;">Deposit Confirmed!</h2>
      <p>Your deposit of $${request.amount} has been confirmed.</p>
      <p><strong>New Balance:</strong> $${user.balance.toFixed(2)}</p>
    </div>
  `;
  sendEmail(user.email, 'Deposit Confirmed', clientHtml);
  
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
  
  const user = await User.findById(request.userId);
  if (user) {
    const clientHtml = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #dc3545;">Deposit Request Rejected</h2>
        <p>Your deposit request has been rejected.</p>
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
    `;
    sendEmail(user.email, 'Deposit Request Rejected', clientHtml);
  }
  
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
  
  const clientHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #28a745;">Withdrawal Approved</h2>
      <p>Your withdrawal of $${request.amount} has been approved.</p>
      <p>Funds have been sent to your wallet.</p>
      <p><strong>New Balance:</strong> $${user.balance.toFixed(2)}</p>
    </div>
  `;
  sendEmail(user.email, 'Withdrawal Approved', clientHtml);
  
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
  
  const user = await User.findById(request.userId);
  if (user) {
    const clientHtml = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #dc3545;">Withdrawal Rejected</h2>
        <p>Your withdrawal request has been rejected.</p>
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
    `;
    sendEmail(user.email, 'Withdrawal Rejected', clientHtml);
  }
  
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
  
  const deleteHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #dc3545;">Account Deleted</h2>
      <p>Your account has been deleted by admin.</p>
      <p>If you believe this is an error, please contact support.</p>
    </div>
  `;
  sendEmail(user.email, 'Account Deleted', deleteHtml);
  
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
  
  const pauseHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #e74c3c;">Account Paused</h2>
      <p>Your account has been paused by admin.</p>
      <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
      <p>You cannot login or trade until further notice.</p>
      <p>Please contact support for more information.</p>
    </div>
  `;
  sendEmail(user.email, 'Account Paused', pauseHtml);
  
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
  
  const resumeHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #28a745;">Account Resumed</h2>
      <p>Your account has been reactivated.</p>
      <p>You can now login and continue trading.</p>
    </div>
  `;
  sendEmail(user.email, 'Account Resumed', resumeHtml);
  
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
  
  const clientHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #28a745;">Order Executed</h2>
      <p><strong>Symbol:</strong> ${order.symbol}/USD</p>
      <p><strong>Side:</strong> ${order.side.toUpperCase()}</p>
      <p><strong>Amount:</strong> $${order.amount}</p>
      <p><strong>Profit/Loss:</strong> ${profitPercentage}% ($${profit.toFixed(2)})</p>
      <p><strong>New Balance:</strong> $${user.balance.toFixed(2)}</p>
    </div>
  `;
  sendEmail(user.email, 'Order Executed', clientHtml);
  
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
      
      const clientHtml = `
        <div style="font-family: Arial, sans-serif;">
          <h2 style="color: #dc3545;">Order Rejected</h2>
          <p>Your order has been rejected.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Refunded Amount:</strong> $${order.amount}</p>
        </div>
      `;
      sendEmail(user.email, 'Order Rejected', clientHtml);
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
  console.log(`📧 Email notifications: configured for jkkevin00@gmail.com`);
  console.log(`🗄️ MongoDB: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
  console.log(`👨‍💼 Admin email: jkkevin00@gmail.com`);
  console.log(`🔑 Admin password: admin123`);
});