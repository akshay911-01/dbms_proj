document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("⚠️ You must log in first!");
        window.location.href = "login.html"; // Redirect to login if not logged in
    } else {
        fetchExpenses(); // Load expenses only if logged in
    }
});

// Function to add an expense
async function addExpense() {
    const category = document.getElementById("category").value;
    const amount = document.getElementById("amount").value;
    const description = document.getElementById("description").value;
    const token = localStorage.getItem("token");

    if (!category || !amount || !description) {
        alert("⚠️ Please fill in all fields.");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/add-expense", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // Include token for authentication
            },
            body: JSON.stringify({ category, amount, description })
        });

        const data = await response.json();
        if (response.ok) {
            alert("✅ Expense added!");
            fetchExpenses();
        } else {
            alert(`❌ Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Error adding expense:", error);
        alert("❌ Failed to connect to server.");
    }
}

// Function to fetch and display expenses
async function fetchExpenses() {
    const token = localStorage.getItem("token");

    try {
        const response = await fetch("http://localhost:5000/expenses", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert("⚠️ Session expired. Please log in again.");
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        const expenses = await response.json();
        const expenseList = document.getElementById("expense-list");
        expenseList.innerHTML = "";

        expenses.forEach(expense => {
            const li = document.createElement("li");
            li.textContent = `${expense.category}: ₹${expense.amount} - ${expense.description}`;
            expenseList.appendChild(li);
        });
    } catch (error) {
        console.error("Error fetching expenses:", error);
        alert("❌ Failed to retrieve expenses.");
    }
}

// Function to log out
function logout() {
    localStorage.removeItem("token");
    alert("👋 Logged out successfully!");
    window.location.href = "login.html";
}
