const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// --- DATABASE CONNECTION ---
// Using the verified password for gloirebolia59_db_user
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected to New Cluster"))
    .catch(err => console.error("❌ Connection Error:", err));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- SESSION CONFIG ---
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

// --- ROUTES ---

// 1. Landing Page (Login Form)
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Blezzy Login</title></head>
        <body style="background:#000;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
            <form action="/login" method="POST" style="background:#111;padding:40px;border-radius:15px;width:300px;border:1px solid #222;box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h2 style="text-align:center;margin-bottom:30px;">Blezzy Login</h2>
                <input name="email" placeholder="Email" required style="width:100%;padding:12px;margin-bottom:15px;background:#222;color:white;border:1px solid #333;border-radius:5px;">
                <input name="passcode" type="password" placeholder="Passcode" required style="width:100%;padding:12px;margin-bottom:25px;background:#222;color:white;border:1px solid #333;border-radius:5px;">
                <button type="submit" style="width:100%;padding:12px;background:#194bfd;color:white;border:none;border-radius:5px;font-weight:bold;cursor:pointer;">Login</button>
            </form>
        </body>
        </html>
    `);
});

// 2. Login Logic
app.post('/login', async (req, res) => {
    const { email, passcode } = req.body;
    try {
        const user = await User.findOne({ email, passcode });
        if (user) {
            req.session.userId = user._id;
            res.redirect('/dashboard');
        } else {
            res.send("<h1>Invalid credentials</h1><a href='/'>Try again</a>");
        }
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

// 3. Dashboard View
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    try {
        const u = await User.findById(req.session.userId);
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
                    <small style="color:grey;">WALLET BALANCE</small>
                    <h1 style="font-size:3em;margin:10px 0;">$${u.balance.toLocaleString()}</h1>
                    <p>Total Capital Locked: <b>$${totalLocked.toLocaleString()}</b></p>
                    <form action="/swap" method="POST">
                        <button type="submit" style="padding:15px 30px;background:#00c853;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">
                            Claim Yield: $${claimableAmount.toFixed(2)}
                        </button>
                    </form>
                </div>
                <br><br>
                <a href="/logout" style="color:#ff5252;text-decoration:none;">Logout Account</a>
            </body>
            </html>
        `);
    } catch (err) {
        res.redirect('/');
    }
});

// 4. Swap/Claim Logic
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

// 5. Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- PORT & START ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Blezzy Server running on port ${PORT}`));
