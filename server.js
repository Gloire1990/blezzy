const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// --- DATABASE CONNECTION ---
// Fixed the duplicate string error here
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:fazilabolia1995@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ 
    secret: 'blezzy_key_99', 
    resave: false, 
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS/SSL
}));

// --- USER SCHEMA ---
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    passcode: String,
    name: String,
    phone: String,
    address: String,
    kycStatus: { type: String, default: "Unverified" },
    idImage: { type: String, default: "" }, 
    isAdmin: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    investments: [{ 
        capital: Number, 
        monthlyRate: Number, 
        startDate: Date, 
        lockEndDate: Date,
        lastClaimDate: Date 
    }],
    pendingDeposit: { amount: Number, status: String, date: Date },
    transactions: [{ type: { type: String }, amount: Number, date: String, details: String }]
});
const User = mongoose.model('User', userSchema);

// --- HELPER LOGIC ---
function calculateMonthlyReward(amount) {
    if (amount >= 500 && amount <= 1000) return 0.03;
    if (amount >= 2000 && amount <= 5000) return 0.045;
    if (amount >= 10000 && amount <= 50000) return 0.07;
    if (amount >= 50000) return 0.20; 
    return 0.01;
}

// --- AUTH ROUTES ---
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#000;color:white;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
            <h1>Blezzy Dollar</h1>
            <a href="/login" style="color:#194bfd;margin-bottom:10px">Login</a>
            <a href="/register" style="color:#194bfd">Sign Up</a>
        </body>
    `);
});

app.get('/register', (req, res) => {
    res.send(`
        <body style="background:#000;color:white;font-family:sans-serif;padding:20px;">
            <h2>Create Account</h2>
            <form action="/register" method="POST">
                <input name="name" placeholder="Full Name" required style="display:block;width:100%;padding:10px;margin:10px 0;">
                <input name="email" type="email" placeholder="Email" required style="display:block;width:100%;padding:10px;margin:10px 0;">
                <input name="passcode" type="password" placeholder="Passcode" required style="display:block;width:100%;padding:10px;margin:10px 0;">
                <button type="submit" style="background:#194bfd;color:white;border:none;padding:15px;width:100%;border-radius:10px;">Register</button>
            </form>
        </body>
    `);
});

app.post('/register', async (req, res) => {
    try {
        const { email, passcode, name } = req.body;
        const newUser = new User({ email, passcode, name });
        await newUser.save();
        res.redirect('/login');
    } catch (e) { res.send("Error: Email already exists."); }
});

app.get('/login', (req, res) => {
    res.send(`
        <body style="background:#000;color:white;font-family:sans-serif;padding:20px;">
            <h2>Login</h2>
            <form action="/login" method="POST">
                <input name="email" type="email" placeholder="Email" required style="display:block;width:100%;padding:10px;margin:10px 0;">
                <input name="passcode" type="password" placeholder="Passcode" required style="display:block;width:100%;padding:10px;margin:10px 0;">
                <button type="submit" style="background:#194bfd;color:white;border:none;padding:15px;width:100%;border-radius:10px;">Enter</button>
            </form>
        </body>
    `);
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, passcode: req.body.passcode });
    if (user) {
        req.session.userId = user._id;
        req.session.isAdmin = user.isAdmin;
        res.redirect(user.isAdmin ? '/admin' : '/dashboard');
    } else {
        res.send("Invalid credentials.");
    }
});

// --- DASHBOARD ROUTE ---
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    res.send(renderDashboard(user));
});

// --- ADMIN PAGE ---
app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.send("Access Denied");
    const users = await User.find({ "pendingDeposit.amount": { $gt: 0 } });
    let list = users.map(u => `
        <div style="border:1px solid #333;padding:10px;margin:10px 0;">
            <p>User: ${u.name} (${u.email})</p>
            <p>Amount: $${u.pendingDeposit.amount}</p>
            <form action="/confirm" method="POST">
                <input type="hidden" name="uid" value="${u._id}">
                <button type="submit" style="background:#00c853;color:white;border:none;padding:10px;">Confirm Deposit</button>
            </form>
        </div>
    `).join('');
    res.send(`<body style="background:#000;color:white;font-family:sans-serif;padding:20px;">
        <h2>Admin Panel - Pending Approvals</h2>
        ${list || '<p>No pending deposits</p>'}
        <br><a href="/logout" style="color:red">Logout</a>
    </body>`);
});

// --- SWAP, CONFIRM & RENDER LOGIC (As per your original code) ---
// [Include your existing app.post('/swap'), app.post('/confirm'), and renderDashboard function here]

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
