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
let depositRequests = [];

// Withdrawal requests storage
let withdrawalRequests = [];

// Orders storage
let orders = [];

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
  
  const newRequest = {
    id: Date.now().toString(),
    userId: user.id,
    userEmail: user.email,
    amount: amount,
    status: 'pending',
    adminWallet: null,
    createdAt: new Date()
  };
  
  depositRequests.push(newRequest);
  
  res.json({ 
    message: `Deposit request for $${amount} submitted.`,
    requestId: newRequest.id,
    status: 'pending'
  });
});

// ============ WITHDRAWAL REQUEST (Client creates request) ============
app.post('/api/request-withdraw', (req, res) => {
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
  
  const newRequest = {
    id: Date.now().toString(),
    userId: user.id,
    userEmail: user.email,
    amount: amount,
    walletAddress: walletAddress,
    status: 'pending',
    createdAt: new Date()
  };
  
  withdrawalRequests.push(newRequest);
  
  res.json({ 
    message: `Withdrawal request for $${amount} submitted. Awaiting admin approval.`,
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
app.post('/api/admin/approve-withdrawal', (req, res) => {
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
  
  res.json({ 
    message: `Withdrawal of $${request.amount} approved and processed.`,
    newBalance: user.balance
  });
});

// ============ ADMIN: Reject withdrawal ============
app.post('/api/admin/reject-withdrawal', (req, res) => {
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
  
  res.json({ 
    message: `Withdrawal request rejected`
  });
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
    message: `Wallet address provided.`,
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
    message: `Payment confirmation submitted.`
  });
});

// ============ ADMIN: Confirm deposit ============
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
  
  user.balance += request.amount;
  
  request.status = 'completed';
  request.completedAt = new Date();
  
  res.json({ 
    message: `Deposit of $${request.amount} confirmed and added.`,
    newBalance: user.balance
  });
});

// ============ ADMIN: Reject deposit ============
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
      withdrawLimit: user.withdrawLimit
    }
  });
});

// ============ TRADING ENDPOINTS ============

// Place order
app.post('/api/place-order', (req, res) => {
  const { symbol, type, side, amount, price, currentPrice, walletType, timeframe } = req.body;
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
  
  const executePrice = type === 'market' ? currentPrice : price;
  const totalCost = amount;
  
  if (side === 'buy') {
    if (user.balance < totalCost) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    if (type === 'market') {
      user.balance -= totalCost;
      const newOrder = {
        id: Date.now().toString(),
        userId: user.id,
        symbol: symbol,
        type: type,
        side: side,
        amount: amount,
        price: executePrice,
        filled: amount,
        status: 'filled',
        walletType: walletType || 'BTC',
        timeframe: timeframe || 60,
        createdAt: new Date()
      };
      orders.push(newOrder);
      
      return res.json({ 
        message: `Bought ${(amount / executePrice).toFixed(6)} ${symbol} at $${executePrice}`,
        newBalance: user.balance,
        orderId: newOrder.id
      });
    } else {
      const newOrder = {
        id: Date.now().toString(),
        userId: user.id,
        symbol: symbol,
        type: type,
        side: side,
        amount: amount,
        price: price,
        filled: 0,
        status: 'open',
        walletType: walletType || 'BTC',
        timeframe: timeframe || 60,
        createdAt: new Date()
      };
      orders.push(newOrder);
      
      return res.json({ 
        message: `Limit buy order placed for $${amount} at $${price}`,
        orderId: newOrder.id
      });
    }
  } else {
    if (type === 'market') {
      user.balance += totalCost;
      const newOrder = {
        id: Date.now().toString(),
        userId: user.id,
        symbol: symbol,
        type: type,
        side: side,
        amount: amount,
        price: executePrice,
        filled: amount,
        status: 'filled',
        walletType: walletType || 'BTC',
        timeframe: timeframe || 60,
        createdAt: new Date()
      };
      orders.push(newOrder);
      
      return res.json({ 
        message: `Sold ${(amount / executePrice).toFixed(6)} ${symbol} at $${executePrice}`,
        newBalance: user.balance,
        orderId: newOrder.id
      });
    } else {
      const newOrder = {
        id: Date.now().toString(),
        userId: user.id,
        symbol: symbol,
        type: type,
        side: side,
        amount: amount,
        price: price,
        filled: 0,
        status: 'open',
        walletType: walletType || 'BTC',
        timeframe: timeframe || 60,
        createdAt: new Date()
      };
      orders.push(newOrder);
      
      return res.json({ 
        message: `Limit sell order placed for $${amount} at $${price}`,
        orderId: newOrder.id
      });
    }
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
  
  const userOrders = orders.filter(o => o.userId === user.id && o.status === 'open');
  
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
  
  const userOrders = orders.filter(o => o.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
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
  
  orders[orderIndex].status = 'cancelled';
  
  res.json({ message: 'Order cancelled' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});