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
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("🔥 MongoDB connected successfully!"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// User Schema & Model
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model("User", UserSchema);

// Expense Schema & Model
const ExpenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
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

        // Check if email already exists
        if (await User.findOne({ email })) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Hash password and save user
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

// 🔹 Add Expense (Authenticated)
app.post("/add-expense", authenticateToken, async (req, res) => {
    try {
        const { category, amount, description } = req.body;

        if (!category || !amount || !description) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newExpense = new Expense({ userId: req.userId, category, amount, description });
        await newExpense.save();
        res.status(201).json({ message: "Expense added successfully" });
    } catch (error) {
        console.error("Error adding expense:", error);
        res.status(500).json({ error: "Error adding expense" });
    }
});

// 🔹 Fetch Expenses for Logged-in User (Authenticated)
app.get("/expenses", authenticateToken, async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ error: "Error fetching expenses" });
    }
});

// 🔹 Delete an Expense (Authenticated)
app.delete("/delete-expense/:id", authenticateToken, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        if (expense.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Unauthorized to delete this expense" });
        }

        await Expense.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense:", error);
        res.status(500).json({ error: "Error deleting expense" });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
