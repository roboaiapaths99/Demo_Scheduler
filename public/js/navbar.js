// Shared Navbar Component - Role Aware
class NavbarManager {
    constructor() {
        this.init();
    }

    init() {
        this.updateNavbar();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle logout
        window.logout = () => this.handleLogout();
    }

    updateNavbar() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('accessToken');

        const navbar = document.querySelector('.navbar-menu');
        if (!navbar) return;

        // Clear existing links
        const navLinks = navbar.querySelectorAll('.nav-link[data-role]');
        navLinks.forEach(link => link.remove());

        // Get currently logged in
        if (token) {
            // Remove general "Home" link
            const homeLink = Array.from(navbar.querySelectorAll('.nav-link'))
                .find(link => link.textContent === 'Home');
            if (homeLink && homeLink.href.includes('index.html')) {
                homeLink.style.display = 'none';
            }

            // Show only role-specific dashboard
            if (user.role === 'tutor') {
                this.addNavLink(navbar, 'Tutor Dashboard', '/dashboard-tutor.html', 'tutor');
                this.addNavLink(navbar, 'Pending Bookings', '/pending-bookings.html', 'tutor');
                this.addNavLink(navbar, 'My Bookings', '/bookings.html', 'tutor');
            } else if (user.role === 'sales') {
                this.addNavLink(navbar, 'Sales Dashboard', '/dashboard-sales.html', 'sales');
                this.addNavLink(navbar, 'Tutors', '/tutors.html', 'sales');
                this.addNavLink(navbar, 'Bookings', '/sales-bookings.html', 'sales');
            } else if (user.role === 'admin') {
                this.addNavLink(navbar, 'Admin Dashboard', '/dashboard-admin.html', 'admin');
                this.addNavLink(navbar, 'Users', '/users.html', 'admin');
                this.addNavLink(navbar, 'Analytics', '/analytics.html', 'admin');
            }
        }
    }

    addNavLink(navbar, text, href, role) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        link.className = 'nav-link';
        link.setAttribute('data-role', role);
        navbar.appendChild(link);
    }

    handleLogout() {
        // Clear tokens and user data
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // Unsubscribe from notifications
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    if (subscription) {
                        subscription.unsubscribe();
                    }
                });
            });
        }

        // Redirect to home
        window.location.href = '/index.html';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NavbarManager();
    });
} else {
    new NavbarManager();
}
