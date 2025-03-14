const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");

// ➤ Add a new expense
router.post("/add", async (req, res) => {
    try {
        const { title, amount, category, date } = req.body;
        if (!title || !amount || !category || !date) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const newExpense = new Expense({ title, amount, category, date });
        await newExpense.save();
        res.status(201).json({ message: "Expense added successfully!", expense: newExpense });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error!" });
    }
});

// ➤ Fetch all expenses
router.get("/", async (req, res) => {
    try {
        const expenses = await Expense.find().sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error!" });
    }
});

// ➤ Fetch expenses by category
router.get("/category/:category", async (req, res) => {
    try {
        const expenses = await Expense.find({ category: req.params.category });
        res.json(expenses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error!" });
    }
});

// ➤ Delete an expense
router.delete("/:id", async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: "Expense not found!" });
        }
        res.json({ message: "Expense deleted successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error!" });
    }
});

module.exports = router;
