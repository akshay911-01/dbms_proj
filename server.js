const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Initialize Express App
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🔥 MongoDB connected successfully!"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// User Schema & Model
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model("User", UserSchema);

// Expense Schema & Model (Fixed)
const ExpenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    title: { type: String, required: true },  // ✅ Changed from description to title
    date: { type: Date, default: Date.now }
});
const Expense = mongoose.model("Expense", ExpenseSchema);

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized, token missing" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.userId = decoded.userId;
        next();
    });
};

// Serve Login & Registration Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// 🔹 Register User
app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (await User.findOne({ email })) {
            return res.status(400).json({ message: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error registering user" });
    }
});

// 🔹 Login User
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Error logging in" });
    }
});

// 🔹 Add Expense (Fixed API)
app.post("/api/expenses/add", authenticateToken, async (req, res) => {
    try {
        console.log("📝 Received Expense Data:", req.body);

        const { title, amount, category, date } = req.body;
        if (!title || !amount || !category || !date) {
            console.log("❌ Missing required fields!");
            return res.status(400).json({ message: "All fields are required" });
        }

        const newExpense = new Expense({ 
            userId: req.userId, 
            category, 
            amount, 
            title,  // ✅ Correct field name
            date 
        });

        await newExpense.save();
        console.log("✅ Expense saved successfully:", newExpense);
        res.status(201).json({ message: "Expense added successfully" });
    } catch (error) {
        console.error("❌ Error adding expense:", error);
        res.status(500).json({ error: "Server Error. Try again later." });
    }
});
app.get("/api/expenses/date/:date", authenticateToken, async (req, res) => {
    try {
        const selectedDate = req.params.date;
        const expenses = await Expense.find({ userId: req.userId, date: selectedDate });
        res.json(expenses);
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ error: "Error fetching expenses" });
    }
});


// 🔹 Fetch Expenses for Logged-in User
app.get("/api/expenses", authenticateToken, async (req, res) => {
    try {
        console.log("🔍 Fetching expenses for user:", req.userId);
        const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });

        console.log("📊 Expenses Fetched:", expenses);
        res.json(expenses);
    } catch (error) {
        console.error("❌ Error fetching expenses:", error);
        res.status(500).json({ error: "Error fetching expenses" });
    }
});

// 🔹 Delete a Single Expense
app.delete("/api/expenses/:id", authenticateToken, async (req, res) => {
    try {
        const expenseId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(expenseId)) {
            return res.status(400).json({ message: "❌ Invalid expense ID" });
        }

        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ message: "❌ Expense not found" });
        }

        if (expense.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "❌ Unauthorized to delete this expense" });
        }

        await Expense.findByIdAndDelete(expenseId);
        res.status(200).json({ message: "✅ Expense deleted successfully!" });
    } catch (error) {
        console.error("❌ Error deleting expense:", error);
        res.status(500).json({ error: "Error deleting expense" });
    }
});
app.get("/expenses/calendar", authenticateToken, async (req, res) => {
    try {
        const expenses = await Expense.aggregate([
            { $match: { userId: req.userId } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, total: { $sum: "$amount" } } },
            { $sort: { _id: 1 } }
        ]);

        const totalExpenses = await Expense.find({ userId: req.userId });

        const dailyAvg = totalExpenses.length > 0 
            ? totalExpenses.reduce((acc, exp) => acc + exp.amount, 0) / new Set(totalExpenses.map(exp => exp.date.toISOString().split('T')[0])).size 
            : 0;

        const monthlyAvg = totalExpenses.length > 0 
            ? totalExpenses.reduce((acc, exp) => acc + exp.amount, 0) / 12 
            : 0;

        res.json({ expenses, dailyAvg, monthlyAvg });
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ error: "Error fetching expenses" });
    }
});


// 🔹 Clear All Expenses
app.delete("/api/expenses/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedExpense = await Expense.findByIdAndDelete(id);
        if (!deletedExpense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense:", error);
        res.status(500).json({ error: "Failed to delete expense" });
    }
});

const ExcelJS = require("exceljs");
const fs = require("fs");

app.get("/export-excel", authenticateToken, async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.userId });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Expenses");

        worksheet.columns = [
            { header: "Category", key: "category", width: 20 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Description", key: "description", width: 30 },
            { header: "Date", key: "date", width: 20 }
        ];

        expenses.forEach(expense => {
            worksheet.addRow({
                category: expense.category,
                amount: expense.amount,
                description: expense.description,
                date: expense.date.toISOString().split("T")[0]
            });
        });

        const filePath = "./expenses.xlsx";
        await workbook.xlsx.writeFile(filePath);

        res.download(filePath, "expenses.xlsx", () => {
            fs.unlinkSync(filePath); // Delete file after sending
        });

    } catch (error) {
        console.error("Error exporting expenses:", error);
        res.status(500).json({ error: "Failed to export expenses" });
    }
});
function updateStatistics() {
    let total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    let dailyAvg = total / 30;
    let monthlyAvg = total / 12;

    document.getElementById("totalExpenses").innerText = total.toFixed(2);
    document.getElementById("dailyAvg").innerText = dailyAvg.toFixed(2);
    document.getElementById("monthlyAvg").innerText = monthlyAvg.toFixed(2);

    // 🔹 Calculate Expense Summary
    let categoryTotals = {};
    let categoryCounts = {};

    expenses.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        categoryCounts[exp.category] = (categoryCounts[exp.category] || 0) + 1;
    });

    // 🔥 Find highest spending category
    let highestCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b, "-");

    // 🔥 Find most frequently used category
    let frequentCategory = Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b, "-");

    // Update UI
    document.getElementById("highestCategory").innerText = highestCategory;
    document.getElementById("frequentCategory").innerText = frequentCategory;

    // 🔹 Update category-wise spending list
    let categorySummaryList = document.getElementById("categorySummary");
    categorySummaryList.innerHTML = Object.entries(categoryTotals)
        .map(([category, amount]) => `<li>${category}: ₹${amount.toFixed(2)}</li>`)
        .join("");
}



// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
