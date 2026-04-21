const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// --- DATABASE CONNECTION ---
// Using your NEW cluster: gloirebolia59_db_user
const MONGO_URI = "mongodb+srv://gloirebolia59_db_user:fazilabolia@cluster0.6l5oydy.mongodb.net/blezzypay?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Database Connected to New Cluster"))
    .catch(err => console.error("❌ Connection Error:", err));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({ 
    secret: 'blezzy_key_99', 
    resave: false, 
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS on Render
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
    return 0.01; 
}

// --- SWAP (CLAIM) ROUTE ---
app.post('/swap', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const u = await User.findById(req.session.userId);
    const now = new Date();
    let totalReleased = 0;
    
    // Process each investment
    for (let i = 0; i < u.investments.length; i++) {
        let inv = u.investments[i];
        const daysSinceLastClaim = Math.floor((now - new Date(inv.lastClaimDate)) / (1000 * 60 * 60 * 24));

        // 1. Release Monthly Profit if 30 days passed
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

        // 2. Principal Check: Note that we don't automatically remove it here 
        // unless you want the capital to return to balance after 1 year.
        if (now >= new Date(inv.lockEndDate)) {
             // Logic to move capital back to balance after 1 year
             totalReleased += inv.capital;
             u.investments.splice(i, 1); // Remove completed investment
             i--; // Adjust index
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

// --- PORT CONFIG ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Blezzy Server running on port ${PORT}`));
