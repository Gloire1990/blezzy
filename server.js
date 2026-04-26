const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// =============================================================
// ✅ NEW CLUSTER CONNECTION
// =============================================================
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:fazilabolia1995@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected: swedbank.bolia@icloud.com admin active"))
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
// ✅ DATA SCHEMA (Matches your screenshot exactly)
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
            // Successful redirect based on isAdmin flag
            return res.redirect(user.isAdmin ? '/admin' : '/dashboard');
        }
        res.send('Invalid Credentials. <a href="/">Try Again</a>');
    } catch (err) {
        res.send("System Error: " + err.message);
    }
});

// =============================================================
// ✅ DASHBOARD & ADMIN ROUTES
// =============================================================

app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u) return res.redirect('/');
    res.send(renderDashboard(u));
});

app.get('/admin', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    
    // Safety check: redirect if they aren't actually an admin
    if (!u || !u.isAdmin) return res.redirect('/dashboard');
    
    const allUsers = await User.find({});
    res.send(renderAdmin(u, allUsers));
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// =============================================================
// ✅ UI COMPONENTS
// =============================================================
const css = `body { background:#000; color:#fff; font-family:sans-serif; margin:0; padding:20px; } .card { background:#111; padding:20px; border-radius:15px; border:1px solid #222; margin-bottom:10px; } button { background:#194bfd; color:white; border:none; padding:12px; border-radius:8px; width:100%; cursor:pointer; } input { width:100%; padding:10px; margin:10px 0; background:#222; border:1px solid #333; color:white; }`;

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
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button onclick="alert('Coming soon')">Deposit</button>
        <button onclick="alert('Coming soon')">Withdraw</button>
    </div>
    <br><a href="/logout" style="color:#666">Logout Session</a>
    </body></html>`;
}

function renderAdmin(admin, users) {
    return `<html><style>${css}</style><body>
    <h2>Admin Control Center</h2>
    <p>Logged in as: ${admin.email}</p>
    <div class="card">
        <h3>User Management</h3>
        <p>Total Registered Users: ${users.length}</p>
        <hr style="border:0; border-top:1px solid #333">
        ${users.map(u => `
            <div style="margin-bottom:10px; padding:10px; border-bottom:1px solid #222">
                <b>${u.name}</b> (${u.email})<br>
                Balance: $${u.balance} | Status: ${u.kycStatus}
            </div>
        `).join('')}
    </div>
    <a href="/dashboard">Back to My Dashboard</a> | <a href="/logout">Logout</a>
    </body></html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Blezzy Live on ${PORT}`));
