// Authentication Service
// Handles login, signup, and user state management

// Get API base URL from config.js (set as window.API_BASE_URL)
function getApiBaseUrl() {
    return window.API_BASE_URL || 'http://localhost:3001/api';
}

// User state
let currentUser = null;
let authToken = null;

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('auth_token');
    const oauthUserId = urlParams.get('user_id');
    const oauthEmail = urlParams.get('email');
    const oauthName = urlParams.get('name');
    const authError = urlParams.get('auth_error');
    
    if (oauthToken && oauthUserId && oauthEmail) {
        // OAuth callback - save token and user
        authToken = oauthToken;
        currentUser = {
            id: parseInt(oauthUserId),
            email: decodeURIComponent(oauthEmail),
            name: oauthName ? decodeURIComponent(oauthName) : null
        };
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        updateUI();
        window.dispatchEvent(new CustomEvent('userLoggedIn'));
    } else if (authError) {
        // OAuth error
        console.error('OAuth error:', authError);
        let errorMessage = 'Authentication failed. Please try again.';
        if (authError === 'oauth_not_configured') {
            errorMessage = 'Google OAuth is not configured on the server. Please use email/password authentication.';
        } else if (authError === 'google_failed') {
            errorMessage = 'Google authentication failed. Please try again or use email/password.';
        }
        alert(errorMessage);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        // Check for stored token
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
            authToken = storedToken;
            currentUser = JSON.parse(storedUser);
            // Verify token is still valid
            verifyToken();
        }
    }
    
    setupAuthModal();
    updateUI();
});

function setupAuthModal() {
    const modal = document.getElementById('authModal');
    const loginButton = document.getElementById('loginButton');
    const closeButton = document.querySelector('.auth-modal-close');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginSubmit = document.getElementById('loginSubmit');
    const signupSubmit = document.getElementById('signupSubmit');
    const googleLogin = document.getElementById('googleLogin');
    const googleSignup = document.getElementById('googleSignup');
    
    // Open modal
    loginButton.addEventListener('click', () => {
        // Clear any errors when opening modal
        const loginError = document.getElementById('loginError');
        const signupError = document.getElementById('signupError');
        if (loginError) {
            loginError.textContent = '';
            loginError.style.display = 'none';
        }
        if (signupError) {
            signupError.textContent = '';
            signupError.style.display = 'none';
        }
        modal.style.display = 'flex';
    });
    
    // Close modal
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Switch between login and signup
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Clear errors when switching tabs
            const loginError = document.getElementById('loginError');
            const signupError = document.getElementById('signupError');
            if (loginError) {
                loginError.textContent = '';
                loginError.style.display = 'none';
            }
            if (signupError) {
                signupError.textContent = '';
                signupError.style.display = 'none';
            }
            
            if (tabName === 'login') {
                loginForm.style.display = 'block';
                signupForm.style.display = 'none';
            } else {
                loginForm.style.display = 'none';
                signupForm.style.display = 'block';
            }
        });
    });
    
    // Login
    loginSubmit.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
        
        try {
            const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('user', JSON.stringify(currentUser));
                modal.style.display = 'none';
                updateUI();
                // Trigger custom event for starred professors
                window.dispatchEvent(new CustomEvent('userLoggedIn'));
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    });
    
    // Signup
    signupSubmit.addEventListener('click', async () => {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const errorDiv = document.getElementById('signupError');
        
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
        
        try {
            const response = await fetch(`${getApiBaseUrl()}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('user', JSON.stringify(currentUser));
                modal.style.display = 'none';
                updateUI();
                window.dispatchEvent(new CustomEvent('userLoggedIn'));
            } else {
                errorDiv.textContent = data.error || 'Signup failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    });
    
    // Google OAuth
    googleLogin.addEventListener('click', async () => {
        const errorDiv = document.getElementById('loginError');
        const API_BASE = getApiBaseUrl().replace('/api', '');
        
        try {
            // Check if OAuth is configured
            const checkResponse = await fetch(`${getApiBaseUrl()}/auth/google`);
            
            if (checkResponse.status === 503) {
                const data = await checkResponse.json();
                errorDiv.textContent = 'Google OAuth is not configured. Please use email/password login or contact the administrator.';
                errorDiv.style.display = 'block';
                return;
            }
            
            // If we get here, OAuth should be configured - redirect
            if (checkResponse.ok || checkResponse.status === 302) {
                window.location.href = `${API_BASE}/api/auth/google`;
            } else {
                errorDiv.textContent = 'Unable to initiate Google login. Please try again.';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error checking OAuth:', error);
            // Try redirecting anyway - might work if server is configured
            window.location.href = `${API_BASE}/api/auth/google`;
        }
    });
    
    googleSignup.addEventListener('click', async () => {
        const errorDiv = document.getElementById('signupError');
        const API_BASE = getApiBaseUrl().replace('/api', '');
        
        try {
            // Check if OAuth is configured
            const checkResponse = await fetch(`${getApiBaseUrl()}/auth/google`);
            
            if (checkResponse.status === 503) {
                const data = await checkResponse.json();
                errorDiv.textContent = 'Google OAuth is not configured. Please use email/password signup or contact the administrator.';
                errorDiv.style.display = 'block';
                return;
            }
            
            // If we get here, OAuth should be configured - redirect
            if (checkResponse.ok || checkResponse.status === 302) {
                window.location.href = `${API_BASE}/api/auth/google`;
            } else {
                errorDiv.textContent = 'Unable to initiate Google signup. Please try again.';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error checking OAuth:', error);
            // Try redirecting anyway - might work if server is configured
            window.location.href = `${API_BASE}/api/auth/google`;
        }
    });
}

async function verifyToken() {
    if (!authToken) return false;
    
    try {
        const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            return true;
        } else {
            // Token invalid, clear it
            logout();
            return false;
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        return false;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    updateUI();
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
}

function updateUI() {
    const loginButton = document.getElementById('loginButton');
    const starredTabContainer = document.getElementById('starredTabContainer');
    
    if (currentUser) {
        loginButton.textContent = `Logout (${currentUser.email})`;
        loginButton.onclick = logout;
        starredTabContainer.style.display = 'flex';
    } else {
        loginButton.textContent = 'Login';
        loginButton.onclick = () => {
            document.getElementById('authModal').style.display = 'flex';
        };
        starredTabContainer.style.display = 'none';
    }
}

// Export functions for use in other scripts
window.authService = {
    getCurrentUser: () => currentUser,
    getAuthToken: () => authToken,
    isAuthenticated: () => !!currentUser,
    logout: logout
};

