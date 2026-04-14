// Authentication JavaScript
class AuthManager {
    constructor() {
        this.baseURL = '/api/auth';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegister.bind(this));
        }

        // Clear errors on input
        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    checkExistingAuth() {
        const token = localStorage.getItem('accessToken');
        if (token && !this.isTokenExpired(token)) {
            this.redirectToDashboard();
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        };

        if (!this.validateLoginForm(loginData)) {
            return;
        }

        await this.performLogin(loginData);
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const registerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword'),
            role: formData.get('role')
        };

        if (!this.validateRegisterForm(registerData)) {
            return;
        }

        await this.performRegister(registerData);
    }

    validateLoginForm(data) {
        let isValid = true;

        if (!data.email || !this.isValidEmail(data.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!data.password || data.password.length < 6) {
            this.showFieldError('password', 'Password must be at least 6 characters');
            isValid = false;
        }

        return isValid;
    }

    validateRegisterForm(data) {
        let isValid = true;

        if (!data.name || data.name.length < 2) {
            this.showFieldError('name', 'Name must be at least 2 characters');
            isValid = false;
        }

        if (!data.email || !this.isValidEmail(data.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!data.password || data.password.length < 6) {
            this.showFieldError('password', 'Password must be at least 6 characters');
            isValid = false;
        }

        if (data.password !== data.confirmPassword) {
            this.showFieldError('confirmPassword', 'Passwords do not match');
            isValid = false;
        }

        if (!data.role) {
            this.showFieldError('role', 'Please select a role');
            isValid = false;
        }

        return isValid;
    }

    async performLogin(data) {
        const loginBtn = document.getElementById('loginBtn');
        const btnText = loginBtn.querySelector('.btn-text');
        const btnLoader = loginBtn.querySelector('.btn-loader');

        try {
            this.setLoadingState(loginBtn, true, 'Signing in...');

            const response = await fetch(`${this.baseURL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Important for cookies
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.handleAuthSuccess(result.data, 'Login successful!');
            } else {
                this.showMessage(result.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoadingState(loginBtn, false, 'Sign In');
        }
    }

    async performRegister(data) {
        const registerBtn = document.getElementById('registerBtn');
        const btnText = registerBtn.querySelector('.btn-text');
        const btnLoader = registerBtn.querySelector('.btn-loader');

        try {
            this.setLoadingState(registerBtn, true, 'Creating account...');

            const { confirmPassword, ...registerPayload } = data;

            const response = await fetch(`${this.baseURL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerPayload)
            });

            const result = await response.json();

            if (result.success) {
                this.handleAuthSuccess(result.data, 'Registration successful!');
            } else {
                this.showMessage(result.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoadingState(registerBtn, false, 'Create Account');
        }
    }

    handleAuthSuccess(data, message) {
        // Store tokens and user data
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        this.showMessage(message, 'success');

        // Request notification permission
        this.requestNotificationPermission();

        // Redirect to role-based dashboard after short delay
        setTimeout(() => {
            const redirectUrl = data.redirectUrl || this.getRoleDashboardUrl(data.user.role);
            window.location.href = redirectUrl;
        }, 1500);
    }

    getRoleDashboardUrl(role) {
        switch(role.toLowerCase()) {
            case 'tutor':
                return '/new-tutor-dashboard.html';
            case 'sales':
                return '/new-sales-dashboard.html';
            case 'admin':
                return '/admin-dashboard.html';
            default:
                return '/index.html';
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Notification permission granted');
                    this.subscribeToNotifications();
                }
            });
        }
    }

    async subscribeToNotifications() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered');
                
                // Subscribe to push notifications
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(
                        'YourPublicKeyHere' // Replace with actual VAPID public key
                    )
                });

                // Send subscription to server
                await fetch('/api/auth/notifications/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                    },
                    body: JSON.stringify(subscription)
                });
                
                console.log('✅ Push notification subscription successful');
            } catch (error) {
                console.error('Notification subscription error:', error);
            }
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    redirectToDashboard() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Redirect based on role
        switch (user.role) {
            case 'tutor':
                window.location.href = 'dashboard-tutor.html';
                break;
            case 'sales':
                window.location.href = 'dashboard-sales.html';
                break;
            case 'admin':
                window.location.href = 'dashboard-admin.html';
                break;
            default:
                window.location.href = 'index.html';
        }
    }

    setLoadingState(button, isLoading, text) {
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (isLoading) {
            button.disabled = true;
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-block';
            btnLoader.textContent = text;
        } else {
            button.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoader.style.display = 'none';
        }
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}Error`);
        
        if (field && errorElement) {
            field.classList.add('error');
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    clearFieldError(field) {
        const fieldId = field.id;
        const errorElement = document.getElementById(`${fieldId}Error`);
        
        field.classList.remove('error');
        if (errorElement) {
            errorElement.classList.remove('show');
        }
    }

    showMessage(message, type) {
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `message ${type}`;
            messageElement.style.display = 'block';

            // Auto hide after 5 seconds
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return Date.now() >= payload.exp * 1000;
        } catch (error) {
            return true;
        }
    }

    // Logout method
    async logout() {
        try {
            await fetch(`${this.baseURL}/logout`, {
                method: 'POST',
                credentials: 'include' // Important for cookies
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and redirect
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// Make logout available globally
window.logout = () => authManager.logout();
