const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Users storage with balances
let users = [
  {
    id: 'admin1',
    email: 'admin@clutch.com',
    password: 'admin123',
    balance: 0,
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
    isAdmin: false,
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  res.json({ 
    message: 'Registration successful', 
    token: newUser.id,
    user: { email: email, balance: 0 }
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
      isAdmin: user.isAdmin || false
    }
  });
});

// Get user balance
app.get('/api/balance', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  res.json({ balance: user.balance });
});

// Deposit (Admin only)
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
  
  user.balance += amount;
  
  res.json({ 
    message: `Deposited $${amount} to ${user.email}`,
    newBalance: user.balance
  });
});

// Withdraw (User)
app.post('/api/withdraw', (req, res) => {
  const { amount } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const user = users.find(u => u.id === token);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (user.balance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  
  user.balance -= amount;
  
  res.json({ 
    message: `Withdrawn $${amount} successfully`,
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
      balance: user.balance 
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