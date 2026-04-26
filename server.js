const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// =============================================================
// ✅ DATABASE CONNECTION
// =============================================================
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:fazilabolia1995@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected: Admin & Management Active"))
    .catch(err => console.error("❌ Database Error:", err));

// Deployment Middlewares
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'blezzy_secret_99', 
    resave: false, 
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// =============================================================
// ✅ DATA SCHEMA
// =============================================================
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
    investments: [{ capital: Number, profit: Number, date: Date }],
    pendingDeposit: { amount: Number, status: String, date: Date },
    transactions: [{ type: { type: String }, amount: Number, date: String }]
});
const User = mongoose.model('User', userSchema);

// =============================================================
// ✅ AUTHENTICATION
// =============================================================

app.get('/', (req, res) => res.send(renderLogin()));

app.post('/login', async (req, res) => {
    const inputEmail = req.body.email.toLowerCase().trim();
    const inputPass = req.body.passcode.trim();

    try {
        const user = await User.findOne({ email: inputEmail });
        if (user && user.passcode === inputPass) {
            req.session.userId = user._id;
            return res.redirect(user.isAdmin ? '/admin' : '/dashboard');
        }
        res.send('Invalid Credentials. <a href="/">Try Again</a>');
    } catch (err) {
        res.send("System Error: " + err.message);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// =============================================================
// ✅ USER ROUTES (Dashboard & Deposits)
// =============================================================

app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u) return res.redirect('/');
    res.send(renderDashboard(u));
});

app.post('/request-deposit', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const amount = parseFloat(req.body.amount);
    await User.findByIdAndUpdate(req.session.userId, {
        pendingDeposit: { amount: amount, status: "Pending", date: new Date() }
    });
    res.redirect('/dashboard'); // Or to a payment instruction page
});

// =============================================================
// ✅ ADMIN ROUTES (Management & Approvals)
// =============================================================

app.get('/admin', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u || !u.isAdmin) return res.redirect('/dashboard');
    
    const allUsers = await User.find({});
    res.send(renderAdmin(u, allUsers));
});

app.post('/admin/approve-deposit', async (req, res) => {
    const admin = await User.findById(req.session.userId);
    if (!admin || !admin.isAdmin) return res.send("Denied");

    const user = await User.findById(req.body.userId);
    if (user && user.pendingDeposit) {
        const amountToAdd = user.pendingDeposit.amount;
        user.balance += amountToAdd;
        user.transactions.push({ 
            type: "Deposit Approved", 
            amount: amountToAdd, 
            date: new Date().toLocaleDateString() 
        });
        user.pendingDeposit = null;
        await user.save();
    }
    res.redirect('/admin');
});

app.post('/admin/approve-kyc', async (req, res) => {
    const admin = await User.findById(req.session.userId);
    if (!admin || !admin.isAdmin) return res.send("Denied");
    await User.findByIdAndUpdate(req.body.userId, { kycStatus: "Verified" });
    res.redirect('/admin');
});

app.post('/admin/reset-passcode', async (req, res) => {
    const admin = await User.findById(req.session.userId);
    if (!admin || !admin.isAdmin) return res.send("Denied");
    await User.findByIdAndUpdate(req.body.userId, { passcode: req.body.newPasscode });
    res.redirect('/admin');
});

// =============================================================
// ✅ UI COMPONENTS (Merged)
// =============================================================
const css = `
    body { background:#000; color:#fff; font-family:sans-serif; margin:0; padding:20px; } 
    .card { background:#111; padding:20px; border-radius:15px; border:1px solid #222; margin-bottom:10px; } 
    button { background:#194bfd; color:white; border:none; padding:12px; border-radius:8px; width:100%; cursor:pointer; } 
    input { width:100%; padding:10px; margin:10px 0; background:#222; border:1px solid #333; color:white; }
    .status-tag { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
`;

function renderLogin() {
    return `<html><style>${css}</style><body style="display:flex;align-items:center;justify-content:center;height:100vh">
    <div style="text-align:center; max-width:300px;">
        <h2>BLEZZY DOLLARS</h2>
        <form action="/login" method="POST">
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="passcode" placeholder="Passcode" required>
            <button>Login</button>
        </form>
    </div></body></html>`;
}

function renderDashboard(u) {
    return `<html><style>${css}</style><body>
    <h2>Welcome, ${u.name}</h2>
    <div class="card">
        <small>Portfolio Balance</small>
        <div style="font-size:30px;">$${u.balance.toFixed(2)}</div>
        <div style="margin-top:10px;"><small>Status: ${u.kycStatus}</small></div>
    </div>
    <div class="card">
        <h3>Deposit Funds</h3>
        <form action="/request-deposit" method="POST">
            <input type="number" name="amount" placeholder="Amount in USD" required>
            <button type="submit">Submit Deposit Request</button>
        </form>
    </div>
    <br><a href="/logout" style="color:#666">Logout Session</a>
    </body></html>`;
}

function renderAdmin(admin, users) {
    const pendingDeposits = users.filter(u => u.pendingDeposit && u.pendingDeposit.status === "Pending");
    const pendingKYC = users.filter(u => u.kycStatus === "Unverified" && u.idImage !== "");

    return `<html><style>${css}</style><body>
    <h2>Admin Center</h2>
    <p>Logged in: ${admin.email}</p>

    <div class="card" style="border-left: 5px solid #194bfd;">
        <h3>💰 Pending Deposits</h3>
        ${pendingDeposits.map(u => `
            <div class="card" style="background:#1a1a1a">
                <b>${u.name}</b> requesting $${u.pendingDeposit.amount}<br>
                <form action="/admin/approve-deposit" method="POST" style="margin-top:10px;">
                    <input type="hidden" name="userId" value="${u._id}">
                    <button style="background:#00c853;">Approve & Credit USD</button>
                </form>
            </div>
        `).join('') || '<p>No pending deposits.</p>'}
    </div>

    <div class="card" style="border-left: 5px solid #ffab00;">
        <h3>🆔 KYC Approvals</h3>
        ${pendingKYC.map(u => `
            <div class="card" style="background:#1a1a1a">
                <b>${u.name}</b><br>
                <img src="${u.idImage}" style="width:100%; max-width:200px; margin:10px 0; border-radius:10px;">
                <form action="/admin/approve-kyc" method="POST">
                    <input type="hidden" name="userId" value="${u._id}">
                    <button style="background:#ffab00;">Verify Identity</button>
                </form>
            </div>
        `).join('') || '<p>No KYC documents pending.</p>'}
    </div>

    <div class="card">
        <h3>👥 Registered Users</h3>
        ${users.map(u => `
            <div style="padding:10px; border-bottom:1px solid #222;">
                <b>${u.name}</b> (${u.email})<br>
                Balance: $${u.balance.toFixed(2)} | KYC: ${u.kycStatus}
                <form action="/admin/reset-passcode" method="POST" style="display:flex; gap:5px; margin-top:5px;">
                    <input type="hidden" name="userId" value="${u._id}">
                    <input type="text" name="newPasscode" placeholder="New Passcode" style="margin:0; flex:1; padding:5px;">
                    <button style="width:auto; padding:5px 15px; margin:0; font-size:12px;">Reset</button>
                </form>
            </div>
        `).join('')}
    </div>

    <a href="/dashboard">My Dashboard</a> | <a href="/logout">Logout</a>
    </body></html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Blezzy Live on ${PORT}`));
