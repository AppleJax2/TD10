// Use the VITE_API_URL from environment or fallback for development
// Note: Since this isn't using Vite build process directly, we hardcode or use a global config
const API_BASE_URL = /* import.meta.env.VITE_API_URL || */ 'http://localhost:5000'; 

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const errorMessageDiv = document.getElementById('errorMessage');

    // Function to display Bootstrap alert
    const displayError = (message) => {
        errorMessageDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        errorMessageDiv.style.display = 'block'; // Make sure the container is visible
    };

    // Redirect if already logged in
    if (localStorage.getItem('token')) {
        window.location.href = 'dashboard.html';
        return; // Stop script execution if redirecting
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission
        errorMessageDiv.style.display = 'none'; // Hide previous errors
        errorMessageDiv.textContent = ''; // Clear previous content
        errorMessageDiv.innerHTML = ''; // Clear previous content specifically for alerts

        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            // errorMessageDiv.textContent = 'Please enter both email and password.';
            // errorMessageDiv.style.display = 'block';
            displayError('Please enter both email and password.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Login successful (even with dummy token for now)
                console.log('Login successful:', data);
                localStorage.setItem('token', data.token); // Store the token
                localStorage.setItem('userEmail', email); // Optionally store email for display
                window.location.href = 'dashboard.html'; // Redirect to dashboard
            } else {
                // Handle login failure
                console.error('Login failed:', data);
                // errorMessageDiv.textContent = data.message || 'Login failed. Please check your credentials.';
                // errorMessageDiv.style.display = 'block';
                displayError(data.message || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Error during login:', error);
            // errorMessageDiv.textContent = 'An error occurred. Please try again later.';
            // errorMessageDiv.style.display = 'block';
            displayError('An error occurred. Please try again later.');
        }
    });
}); 