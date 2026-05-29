const express = require('express');
const cors = require('cors');
const path = require('path');

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
    createdAt: new Date()
  }
];

// Deposit requests storage
let depositRequests = [
  // {
  //   id: 'req1',
  //   userId: 'user123',
  //   userEmail: 'user@email.com',
  //   amount: 500,
  //   status: 'pending', // pending, approved, rejected
  //   adminWallet: null,
  //   createdAt: new Date()
  // }
];

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

// Register
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  
  const newUser = {
    id: Date.now().toString(),
    email: email,
    password: password,
    balance: 0,
    withdrawLimit: 1000,
    isAdmin: false,
    createdAt: new Date()
  };
  
  users.push(newUser);
  
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
    email: user.email
  });
});

// ============ DEPOSIT REQUEST (Client creates request) ============
app.post('/api/request-deposit', (req, res) => {
  const { amount } = req.body;
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
  
  // Create deposit request
  const newRequest = {
    id: Date.now().toString(),
    userId: user.id,
    userEmail: user.email,
    amount: amount,
    status: 'pending',
    adminWallet: null,
    createdAt: new Date(),
    userMessage: `Deposit request for $${amount}`
  };
  
  depositRequests.push(newRequest);
  
  res.json({ 
    message: `Deposit request for $${amount} submitted. Admin will provide wallet address.`,
    requestId: newRequest.id,
    status: 'pending'
  });
});

// ============ ADMIN PROVIDES WALLET ADDRESS ============
app.post('/api/admin/provide-wallet', (req, res) => {
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
  
  res.json({ 
    message: `Wallet address provided. Client can now send payment.`,
    request: request
  });
});

// ============ CLIENT GETS WALLET ADDRESS ============
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

// ============ CLIENT CONFIRMS PAYMENT SENT ============
app.post('/api/confirm-payment', (req, res) => {
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
  
  res.json({ 
    message: `Payment confirmation submitted. Admin will verify and add funds.`
  });
});

// ============ ADMIN CONFIRMS DEPOSIT (Adds funds) ============
app.post('/api/admin/confirm-deposit', (req, res) => {
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
  
  // Add funds to user balance
  user.balance += request.amount;
  
  request.status = 'completed';
  request.completedAt = new Date();
  
  res.json({ 
    message: `Deposit of $${request.amount} confirmed and added to ${user.email}`,
    newBalance: user.balance
  });
});

// ============ ADMIN REJECTS DEPOSIT ============
app.post('/api/admin/reject-deposit', (req, res) => {
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
  
  res.json({ 
    message: `Deposit request rejected`
  });
});

// ============ WITHDRAW (User) ============
app.post('/api/withdraw', (req, res) => {
  const { amount, walletAddress } = req.body;
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
  
  user.balance -= amount;
  
  // Create withdrawal record
  const withdrawal = {
    id: Date.now().toString(),
    userId: user.id,
    amount: amount,
    walletAddress: walletAddress,
    status: 'completed',
    createdAt: new Date()
  };
  
  res.json({ 
    message: `Withdrawal of $${amount} sent to ${walletAddress.substring(0, 10)}...`,
    newBalance: user.balance
  });
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
    message: `Withdrawal limit for ${user.email} updated to $${newLimit}`,
    newLimit: user.withdrawLimit
  });
});

// ============ ADMIN: Remove balance ============
app.post('/api/admin/remove-balance', (req, res) => {
  const { userId, amount } = req.body;
  const adminToken = req.headers.authorization?.split(' ')[1];
  
  const admin = users.find(u => u.id === adminToken && u.isAdmin === true);
  if (!admin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  
  if (user.balance < amount) {
    return res.status(400).json({ message: 'User does not have sufficient balance' });
  }
  
  user.balance -= amount;
  
  res.json({ 
    message: `Removed $${amount} from ${user.email}`,
    newBalance: user.balance
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
      withdrawLimit: user.withdrawLimit
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Users registered: ${users.length}`);
  console.log(`Deposit requests: ${depositRequests.length}`);
});