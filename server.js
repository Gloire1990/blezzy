const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// --- DATABASE CONNECTION ---
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:fazilaboliaQ@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected to New Cluster"))
    .catch(err => console.error("❌ Connection Error:", err));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ 
    secret: 'blezzy_key_99', 
    resave: false, 
    saveUninitialized: true,
    cookie: { secure: false } 
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

// --- TIER LOGIC ---
function calculateMonthlyReward(amount) {
    if (amount >= 500 && amount <= 1000) return 0.03;
    if (amount >= 2000 && amount <= 5000) return 0.045;
    if (amount >= 10000 && amount <= 50000) return 0.07;
    if (amount >= 50000) return 0.20; 
    return 0.01; 
}

// --- AUTH ROUTES ---

// 1. Landing Page (Login Form)
app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="background:#000;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
            <form action="/login" method="POST" style="background:#111;padding:40px;border-radius:15px;width:300px;border:1px solid #222;">
                <h2>Blezzy Login</h2>
                <input name="email" placeholder="Email" style="width:100%;padding:10px;margin-bottom:10px;background:#222;color:white;border:none;">
                <input name="passcode" type="password" placeholder="Passcode" style="width:100%;padding:10px;margin-bottom:20px;background:#222;color:white;border:none;">
                <button type="submit" style="width:100%;padding:10px;background:#194bfd;color:white;border:none;border-radius:5px;cursor:pointer;">Login</button>
            </form>
        </body>
        </html>
    `);
});

// 2. Login Logic
app.post('/login', async (req, res) => {
    const { email, passcode } = req.body;
    const user = await User.findOne({ email, passcode });
    if (user) {
        req.session.userId = user._id;
        res.redirect('/dashboard');
    } else {
        res.send("Invalid credentials. <a href='/'>Try again</a>");
    }
});

// 3. Dashboard View
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    
    // UI logic from your previous snippet...
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

    res.send(`
        <html>
        <body style="background:#000;color:white;font-family:sans-serif;padding:20px;">
            <h2>Welcome, ${u.name || u.email}</h2>
            <div style="background:#111;padding:20px;border-radius:15px;border:1px solid #222;">
                <small>BALANCE</small>
                <h1>$${u.balance.toFixed(2)}</h1>
                <p>Locked: $${totalLocked.toFixed(2)}</p>
                <form action="/swap" method="POST">
                    <button type="submit" style="padding:15px;background:#00c853;color:white;border:none;border-radius:10px;cursor:pointer;">
                        Claim $${claimableAmount.toFixed(2)}
                    </button>
                </form>
            </div>
            <br><a href="/logout" style="color:grey;">Logout</a>
        </body>
        </html>
    `);
});

// 4. Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- SWAP (CLAIM) ROUTE ---
app.post('/swap', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    const now = new Date();
    let totalReleased = 0;
    
    for (let i = 0; i < u.investments.length; i++) {
        let inv = u.investments[i];
        const daysSinceLastClaim = Math.floor((now - new Date(inv.lastClaimDate)) / (1000 * 60 * 60 * 24));

        if (daysSinceLastClaim >= 30) {
            const monthlyProfit = inv.capital * inv.monthlyRate;
            totalReleased += monthlyProfit;
            u.investments[i].lastClaimDate = now; 
            u.transactions.push({
                type: "Gold Yield",
                amount: monthlyProfit,
                date: new Date().toLocaleDateString(),
                details: `Monthly profit from $${inv.capital} trade`
            });
        }

        if (now >= new Date(inv.lockEndDate)) {
             totalReleased += inv.capital;
             u.investments.splice(i, 1); 
             i--; 
             u.transactions.push({
                type: "Principal Unlock",
                amount: inv.capital,
                date: new Date().toLocaleDateString(),
                details: "1-Year Capital Lock Completed"
            });
        }
    }

    if (totalReleased > 0) {
        u.balance += totalReleased;
        await u.save();
    }
    res.redirect('/dashboard');
});

const PORT = process.env.PORT || 10000; // Render preferred port
app.listen(PORT, () => console.log(`🚀 Blezzy Server running on port ${PORT}`));
