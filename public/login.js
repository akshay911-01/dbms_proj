document.getElementById("loginBtn").addEventListener("click", async function () {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("⚠️ Please enter both email and password!");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert("✅ Login Successful!");
            localStorage.setItem("token", data.token); // Save token
            window.location.href = "dashboard.html"; // Redirect to dashboard
        } else {
            alert("❌ Login Failed: " + data.message);
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("❌ Server Error. Try again later.");
    }
});
