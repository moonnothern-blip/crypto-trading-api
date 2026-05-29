const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Temporary storage (in memory - will reset on restart)
// Later we'll add real database
let users = [];

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Register endpoint
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  
  // Check if user exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  
  // Create new user
  const newUser = {
    id: Date.now().toString(),
    email: email,
    password: password, // In real app, hash this!
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  res.json({ 
    message: 'Registration successful', 
    token: newUser.id,
    user: { email: email }
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  // Find user
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

// Protected dashboard endpoint
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
    message: 'Welcome to dashboard',
    user: { email: user.email }
  });
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Users registered: ${users.length}`);
});