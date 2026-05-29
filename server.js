const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Users storage with balances and limits
let users = [
  {
    id: 'admin1',
    email: 'admin@clutch.com',
    password: 'admin123',
    balance: 0,
    withdrawLimit: 0, // 0 means no limit for admin
    isAdmin: true,
    createdAt: new Date()
  }
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
    withdrawLimit: 1000, // Default daily withdraw limit
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

// Get user balance and limits
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

// Client Deposit (User adds funds themselves)
app.post('/api/deposit', (req, res) => {
  const { amount, paymentMethod } = req.body;
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
  
  // Add balance
  user.balance += amount;
  
  // In production, this would integrate with Stripe/PayPal
  // For now, it's a simulated deposit
  
  res.json({ 
    message: `Successfully deposited $${amount} via ${paymentMethod}`,
    newBalance: user.balance
  });
});

// Admin Deposit (Admin adds funds to any user)
app.post('/api/admin/deposit', (req, res) => {
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
  
  user.balance += amount;
  
  res.json({ 
    message: `Deposited $${amount} to ${user.email}`,
    newBalance: user.balance
  });
});

// Withdraw (User)
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
  
  // Check withdrawal limit
  if (amount > user.withdrawLimit) {
    return res.status(400).json({ 
      message: `Withdrawal limit exceeded. Your limit is $${user.withdrawLimit} per transaction` 
    });
  }
  
  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  
  if (!walletAddress) {
    return res.status(400).json({ message: 'Wallet address required' });
  }
  
  user.balance -= amount;
  
  res.json({ 
    message: `Withdrawal request submitted: $${amount} to ${walletAddress.substring(0, 10)}...`,
    newBalance: user.balance
  });
});

// Admin Update Withdrawal Limit
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

// Admin Remove Balance (Subtract funds)
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

// Admin users list
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Users registered: ${users.length}`);
});