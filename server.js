const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// --- DATABASE CONNECTION ---
const MONGO_URI = "mongodb+srv://const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:<fazilabolia1995>@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";mongoose.connect(MONGO_URI).then(() => console.log("✅ Database Connected"));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ secret: 'blezzy_key_99', resave: false, saveUninitialized: true }));

// --- UPDATED USER SCHEMA ---
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
    // Tracks gold investment tiers and 1-year locks
    investments: [{ 
        capital: Number, 
        monthlyRate: Number, 
        startDate: Date, 
        lockEndDate: Date,    // 1-Year Mark
        lastClaimDate: Date   // 30-Day Cycle
    }],
    pendingDeposit: { amount: Number, status: String, date: Date },
    transactions: [{ type: { type: String }, amount: Number, date: String, details: String }]
});
const User = mongoose.model('User', userSchema);

// --- TIER LOGIC ---
function calculateMonthlyReward(amount) {
    if (amount >= 500 && amount <= 1000) return 0.03;
    if (amount >= 2000 && amount <= 5000) return 0.045;
    if (amount >= 10000 && amount <= 50000) return 0.07;
    if (amount >= 50000) return 0.20; 
    return 0.01; // Default 1% reward as per your new feature
}

// --- UPDATED SWAP (CLAIM) ROUTE ---
app.post('/swap', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    const now = new Date();
    let totalReleased = 0;
    let activeInvestments = [];

    for (let inv of u.investments) {
        let stillLocked = true;
        const daysSinceLastClaim = Math.floor((now - new Date(inv.lastClaimDate)) / (1000 * 60 * 60 * 24));

        // 1. Release Monthly Profit
        if (daysSinceLastClaim >= 30) {
            const monthlyProfit = inv.capital * inv.monthlyRate;
            totalReleased += monthlyProfit;
            inv.lastClaimDate = now; 
            u.transactions.push({
                type: "Gold Yield",
                amount: monthlyProfit,
                date: new Date().toLocaleDateString(),
                details: `Monthly profit from $${inv.capital} trade`
            });
        }

        // 2. Release Principal (Only after 1 Year)
        if (now >= new Date(inv.lockEndDate)) {
            totalReleased += inv.capital;
            stillLocked = false;
            u.transactions.push({
                type: "Principal Unlock",
                amount: inv.capital,
                date: new Date().toLocaleDateString(),
                details: "1-Year Capital Lock Completed"
            });
        }
        if (stillLocked) activeInvestments.push(inv);
    }

    if (totalReleased > 0) {
        u.balance += totalReleased;
        u.investments = activeInvestments;
        await u.save();
    }
    res.redirect('/dashboard');
});

// --- UPDATED ADMIN CONFIRM ---
app.post('/confirm', async (req, res) => {
    const u = await User.findById(req.body.uid);
    if (u && u.pendingDeposit) {
        const amt = u.pendingDeposit.amount;
        const rate = calculateMonthlyReward(amt);
        const startDate = new Date();
        const lockEndDate = new Date();
        lockEndDate.setFullYear(lockEndDate.getFullYear() + 1); // 1 Year Lock

        u.investments.push({ 
            capital: amt, 
            monthlyRate: rate, 
            startDate: startDate, 
            lockEndDate: lockEndDate, 
            lastClaimDate: startDate 
        });

        u.transactions.push({ 
            type: "Deposit", 
            amount: amt, 
            date: new Date().toLocaleDateString(), 
            details: `Locked 1 Year @ ${(rate*100).toFixed(1)}%/mo` 
        });

        u.pendingDeposit = null;
        await u.save();
    }
    res.redirect('/admin');
});

// --- REMAINING ROUTES (Registration, Login, etc. remain the same) ---
// ... [Insert your /login, /register, and /kyc routes here] ...

// --- UPDATED DASHBOARD UI ---
function renderDashboard(u) {
    const now = new Date();
    let claimableAmount = 0;
    let totalLocked = 0;

    u.investments.forEach(inv => {
        totalLocked += inv.capital;
        const daysSinceLastClaim = Math.floor((now - new Date(inv.lastClaimDate)) / (1000 * 60 * 60 * 24));
        if (daysSinceLastClaim >= 30) {
            claimableAmount += (inv.capital * inv.monthlyRate);
        }
    });

    // Simple view of transactions
    const txs = u.transactions.slice().reverse().map(t => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1c2026">
            <div><b>${t.type}</b><br><small>${t.date}</small></div>
            <div style="color:${t.amount > 0 ? '#00c853' : 'white'}">$${t.amount.toFixed(2)}</div>
        </div>`).join('');

    return `
    <html>
    <head><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { background:#000; color:white; font-family:sans-serif; padding:20px; }
        .card { background:#111; padding:20px; border-radius:15px; margin-bottom:20px; border:1px solid #222; }
        .btn { background:#194bfd; color:white; padding:15px; border-radius:10px; text-align:center; text-decoration:none; display:block; font-weight:bold; cursor:pointer; }
    </style>
    </head>
    <body>
        <h2>Welcome, ${u.name.split(' ')[0]}</h2>
        <div class="card">
            <small>AVAILABLE BALANCE</small>
            <h1 style="font-size:40px;margin:10px 0">$${u.balance.toFixed(2)}</h1>
            <div style="border-top:1px solid #333;padding-top:10px">
                <small>LOCKED CAPITAL: $${totalLocked.toFixed(2)}</small>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
            <div class="btn" onclick="alert('Use Deposit Menu Below')">Deposit</div>
            <div class="btn" style="background:${claimableAmount > 0 ? '#00c853' : '#333'}" 
                 onclick="document.getElementById('claimForm').submit()">
                Claim $${claimableAmount.toFixed(2)}
            </div>
        </div>

        <form id="claimForm" action="/swap" method="POST" style="display:none"></form>

        <h3>Recent Activity</h3>
        <div class="card">${txs || 'No history'}</div>
    </body>
    </html>`;
}

app.listen(3000, () => console.log("🚀 Server running on port 3000"));

