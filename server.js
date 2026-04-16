const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'prankpay-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/prankpay')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Contact Schema
const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', contactSchema);

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  balance: { type: Number, default: 500 },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Prank Storage (in-memory for demo, can be moved to MongoDB)
const pranks = {};

// Session storage for spin limits
const userSessions = {};

// Routes
app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

app.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const contact = new Contact({ name, email, message });
    await contact.save();
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    res.json({ success: false, message: 'Error sending message' });
  }
});

// Authentication Routes
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: 'Email already registered!' });
    }
    
    // Create new user with default balance
    const user = new User({ name, email, password, balance: 500 });
    await user.save();
    
    // Set session with balance
    req.session.user = { id: user._id, name: user.name, email: user.email, balance: user.balance };
    
    res.json({ success: true, message: 'Account created successfully!', user: req.session.user });
  } catch (error) {
    res.json({ success: false, message: 'Error creating account' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: 'Email not found. Please sign up first!' });
    }
    
    // Check password
    if (user.password !== password) {
      return res.json({ success: false, message: 'Incorrect password!' });
    }
    
    // Set session with balance
    req.session.user = { id: user._id, name: user.name, email: user.email, balance: user.balance };
    
    res.json({ success: true, message: 'Login successful!', user: req.session.user });
  } catch (error) {
    res.json({ success: false, message: 'Error logging in' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get user session
app.get('/auth/session', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false });
  }
});

// Fake App Routes
app.get('/fake-app', (req, res) => {
  res.render('fake-app/index');
});

app.post('/fake-app/create', (req, res) => {
  const { link, message } = req.body;
  const prankId = uuidv4().substring(0, 8);
  pranks[prankId] = { type: 'fake-app', link, message };
  res.json({ prankId, url: `/p/${prankId}` });
});

app.get('/p/:id', (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank) return res.redirect('/');
  
  // Initialize session for this prank if not exists
  if (!userSessions[req.params.id]) {
    userSessions[req.params.id] = {};
  }
  
  res.render('fake-app/prank', { prank, prankId: req.params.id });
});

app.get('/p/:id/dashboard', (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank) return res.redirect('/');
  
  // Check if user is authenticated
  if (!req.session.user) {
    return res.redirect(`/p/${req.params.id}`);
  }
  
  // Initialize spin count for this user in this prank
  if (!userSessions[req.params.id][req.session.user.id]) {
    userSessions[req.params.id][req.session.user.id] = { spins: 0, scratches: 0 };
  }
  
  res.render('fake-app/dashboard', { 
    prank, 
    prankId: req.params.id,
    user: req.session.user,
    sessionData: userSessions[req.params.id][req.session.user.id],
    balance: req.session.user.balance
  });
});

// API to update spin count and save balance
app.post('/p/:id/spin', async (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank || !req.session.user) {
    return res.json({ success: false, message: 'Unauthorized' });
  }
  
  const sessionData = userSessions[req.params.id][req.session.user.id];
  if (sessionData.spins >= 2) {
    return res.json({ success: false, message: 'Spin limit reached! (2 spins max)' });
  }
  
  sessionData.spins++;
  
  // Get prize amount from request body
  const { prize } = req.body;
  if (prize) {
    // Update user balance in MongoDB
    await User.findByIdAndUpdate(req.session.user.id, { $inc: { balance: prize } });
    req.session.user.balance += prize;
  }
  
  res.json({ success: true, spinsLeft: 2 - sessionData.spins, newBalance: req.session.user.balance });
});

// API to update scratch count and save balance
app.post('/p/:id/scratch', async (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank || !req.session.user) {
    return res.json({ success: false, message: 'Unauthorized' });
  }
  
  const sessionData = userSessions[req.params.id][req.session.user.id];
  if (sessionData.scratches >= 2) {
    return res.json({ success: false, message: 'Scratch limit reached! (2 scratches max)' });
  }
  
  sessionData.scratches++;
  
  // Get prize amount from request body
  const { prize } = req.body;
  if (prize) {
    // Update user balance in MongoDB
    await User.findByIdAndUpdate(req.session.user.id, { $inc: { balance: prize } });
    req.session.user.balance += prize;
  }
  
  res.json({ success: true, scratchesLeft: 2 - sessionData.scratches, newBalance: req.session.user.balance });
});

// Fake Link Routes
app.get('/fake-link', (req, res) => {
  res.render('fake-link/index');
});

app.post('/fake-link/create', (req, res) => {
  const { link, message } = req.body;
  const prankId = uuidv4().substring(0, 8);
  pranks[prankId] = { type: 'fake-link', link, message };
  res.json({ prankId, url: `/l/${prankId}` });
});

app.get('/l/:id', (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank) return res.redirect('/');
  res.render('fake-link/prank', { prank });
});

// Fake QR Code Routes
app.get('/fake-qr', (req, res) => {
  res.render('fake-qr/index');
});

app.post('/fake-qr/create', async (req, res) => {
  const { message } = req.body;
  const prankId = uuidv4().substring(0, 8);
  pranks[prankId] = { type: 'fake-qr', message };
  const qrUrl = `${req.protocol}://${req.get('host')}/q/${prankId}`;
  const qrCode = await QRCode.toDataURL(qrUrl);
  res.json({ prankId, qrCode, url: qrUrl });
});

app.get('/q/:id', (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank) return res.redirect('/');
  res.render('fake-qr/prank', { prank });
});

// Fake Lottery Routes
app.get('/fake-lottery', (req, res) => {
  res.render('fake-lottery/index');
});

app.post('/fake-lottery/create', (req, res) => {
  const { message } = req.body;
  const prankId = uuidv4().substring(0, 8);
  pranks[prankId] = { type: 'fake-lottery', message };
  res.json({ prankId, url: `/lottery/${prankId}` });
});

app.get('/lottery/:id', (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank) return res.redirect('/');
  res.render('fake-lottery/prank', { prank });
});

// Fake Hacker Routes
app.get('/fake-hacker', (req, res) => {
  res.render('fake-hacker/index');
});

app.post('/fake-hacker/create', (req, res) => {
  const { message } = req.body;
  const prankId = uuidv4().substring(0, 8);
  pranks[prankId] = { type: 'fake-hacker', message };
  res.json({ prankId, url: `/h/${prankId}` });
});

app.get('/h/:id', (req, res) => {
  const prank = pranks[req.params.id];
  if (!prank) return res.redirect('/');
  res.render('fake-hacker/prank', { prank });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
