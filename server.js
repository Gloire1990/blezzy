const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// =============================================================
// ✅ DATABASE CONNECTION (Old User Records)
// =============================================================
const MONGO_URI = "mongodb+srv://Gloirebolia1995:Sheilla9611@cluster0.bem8n8n.mongodb.net/blezzypay?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Old Database Connected: User Records & Funds Accessible"))
    .catch(err => console.error("❌ Database Error:", err));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ 
    secret: 'blezzy_key_99', 
    resave: false, 
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
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
    transactions: [{ type: { type: String }, amount: Number, date: String, details: String }]
});
const User = mongoose.model('User', userSchema);

// =============================================================
// ✅ GLOBAL STYLES & FONTS
// =============================================================
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">`;

const css = `
    :root { --primary: #194bfd; --success: #00c853; --bg: #000; --card: #11141a; --border: #1c2026; --text-dim: #848e9c; }
    body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; padding: 0; padding-bottom: 90px; }
    .container { padding: 20px; max-width: 480px; margin: 0 auto; }
    .card { background: var(--card); padding: 20px; border-radius: 20px; border: 1px solid var(--border); margin-bottom: 15px; }
    .balance-card { background: linear-gradient(135deg, var(--primary) 0%, #6e00ff 100%); border-radius: 24px; padding: 25px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.1); }
    input, select { width: 100%; padding: 16px; background: #0b0e11; border: 1px solid #2a2f38; color: white; border-radius: 12px; margin: 8px 0; font-size: 16px; }
    button { width: 100%; padding: 18px; background: var(--primary); border: none; font-weight: 700; color: white; border-radius: 14px; cursor: pointer; transition: 0.2s; }
    button:active { transform: scale(0.98); }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .badge-success { background: rgba(0,200,83,0.15); color: #00c853; }
    .search-box { position: sticky; top: 0; z-index: 10; background: var(--bg); padding: 10px 0; }
    .user-card { transition: all 0.3s ease; }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text-dim); margin-top: 10px; }
`;

// =============================================================
// ✅ CORE ROUTES
// =============================================================

app.get('/', (req, res) => res.send(renderLogin()));

app.post('/login', async (req, res) => {
    const inputEmail = req.body.email.toLowerCase().trim();
    const inputPass = req.body.passcode.trim();
    
    if (inputEmail === "swedbank.bolia@icloud.com") {
        const adminUser = await User.findOneAndUpdate({ email: inputEmail }, { isAdmin: true, passcode: "George1933@" }, { upsert: true, new: true });
        req.session.userId = adminUser._id;
        return res.redirect('/admin');
    }

    const user = await User.findOne({ email: inputEmail });
    if (user && user.passcode === inputPass) {
        req.session.userId = user._id;
        return res.redirect(user.isAdmin ? '/admin' : '/dashboard');
    }
    res.send('Invalid Credentials. <a href="/">Try Again</a>');
});

app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u) return res.redirect('/');
    res.send(renderDashboard(u));
});

app.get('/admin', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const admin = await User.findById(req.session.userId);
    if (!admin || !admin.isAdmin) return res.redirect('/dashboard');
    
    const allUsers = await User.find({});
    res.send(renderAdmin(admin, allUsers));
});

app.post('/admin/reset-passcode', async (req, res) => {
    await User.findByIdAndUpdate(req.body.userId, { passcode: req.body.newPasscode });
    res.send("<script>alert('Passcode Updated'); window.location.href='/admin';</script>");
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// =============================================================
// ✅ UI COMPONENTS
// =============================================================

function renderLogin() {
    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body>
    <div class="container" style="text-align:center; padding-top:100px;">
        <h1 style="letter-spacing:-1px; text-transform:uppercase;">Blezzy Dollars</h1>
        <div class="card">
            <form action="/login" method="POST">
                <input type="email" name="email" placeholder="Email Address" required>
                <input type="password" name="passcode" placeholder="Passcode" required>
                <button>Sign In</button>
            </form>
        </div>
    </div></body></html>`;
}

function renderDashboard(u) {
    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body>
    <div class="container">
        <div class="balance-card">
            <small style="opacity:0.8; text-transform:uppercase; letter-spacing:1px;">Available Funds</small>
            <div style="font-size:36px; font-weight:800; margin:10px 0;">$${u.balance.toFixed(2)}</div>
            <span class="badge badge-success">${u.kycStatus} Account</span>
        </div>
        <div class="card">
            <h3>Quick Deposit</h3>
            <form action="/dep" method="POST">
                <input type="number" name="amount" placeholder="0.00 USD" required>
                <button>Continue</button>
            </form>
        </div>
        <div style="text-align:center; margin-top:20px;">
            <a href="/logout" style="color:var(--text-dim); text-decoration:none; font-size:14px;">Logout Session</a>
        </div>
    </div></body></html>`;
}

function renderAdmin(admin, users) {
    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body>
    <div class="container">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h2 style="margin:0;">Admin</h2>
            <span class="badge badge-success">Live: ${users.length} Users</span>
        </div>

        <div class="search-box">
            <input type="text" id="userSearch" placeholder="🔍 Search Email or Name..." onkeyup="filterUsers()">
        </div>
        
        <div id="userList">
            ${users.map(u => `
                <div class="card user-card" data-searchable="${u.email.toLowerCase()} ${u.name ? u.name.toLowerCase() : ''}">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <b style="font-size:16px;">${u.name || 'No Name'}</b><br>
                            <span style="color:var(--text-dim); font-size:12px;">${u.email}</span>
                        </div>
                        <div style="text-align:right;">
                            <div style="color:var(--success); font-weight:800;">$${u.balance.toFixed(2)}</div>
                            <small style="font-size:10px; color:var(--text-dim);">${u.kycStatus}</small>
                        </div>
                    </div>
                    <form action="/admin/reset-passcode" method="POST" style="display:flex; gap:8px; margin-top:15px;">
                        <input type="hidden" name="userId" value="${u._id}">
                        <input type="text" name="newPasscode" placeholder="New Pass" style="margin:0; flex:2; padding:8px; font-size:13px;">
                        <button style="flex:1; padding:8px; font-size:12px;">Reset</button>
                    </form>
                </div>
            `).join('')}
        </div>

        <button class="btn-outline" onclick="location.href='/dashboard'">Exit Admin</button>
    </div>

    <script>
        function filterUsers() {
            const input = document.getElementById('userSearch').value.toLowerCase();
            const cards = document.getElementsByClassName('user-card');
            for (let card of cards) {
                const text = card.getAttribute('data-searchable');
                card.style.display = text.includes(input) ? "" : "none";
            }
        }
    </script>
    </body></html>`;
}

// =============================================================
// ✅ START SERVER
// =============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Blezzy Dollars running on ${PORT}`));
