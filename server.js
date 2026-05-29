const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Users storage
let users = [];

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
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  res.json({ 
    message: 'Registration successful', 
    token: newUser.id,
    user: { email: email }
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
    user: { email: user.email }
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
    message: 'Welcome',
    user: { email: user.email }
  });
});

// Admin users list
app.get('/api/admin/users', (req, res) => {
  res.json({
    users: users,
    totalUsers: users.length,
    activeUsers: users.length,
    totalVolume: 0,
    pendingKYC: 0
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Users registered: ${users.length}`);
});