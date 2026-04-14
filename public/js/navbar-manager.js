/**
 * Unified Navbar Manager - Handles all navigation across the application
 * Provides role-based navigation with proper data visibility
 */

class NavbarManager {
  constructor() {
    this.user = this.getUser();
    this.token = localStorage.getItem('accessToken');
  }

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Initialize navbar for current page
   * Call this on every page that needs navbar
   */
  async init() {
    await this.checkAuthentication();
    this.renderNavbar();
    this.setupEventListeners();
  }

  checkAuthentication() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  /**
   * Get navigation items based on user role
   */
  getNavItems() {
    const { role } = this.user;
    const baseItems = [];

    if (role === 'tutor') {
      return [
        { text: 'Dashboard', href: '/new-tutor-dashboard.html', active: this.isActive('/new-tutor-dashboard') },
        { text: 'My Availability', href: '/tutor-availability.html', active: this.isActive('/tutor-availability') },
        { text: 'My Bookings', href: '/tutor-bookings.html', active: this.isActive('/tutor-bookings') },
        { text: 'Pending Requests', href: '/tutor-bookings.html', active: this.isActive('/tutor-bookings') }
      ];
    } else if (role === 'sales') {
      return [
        { text: 'Dashboard', href: '/new-sales-dashboard.html', active: this.isActive('/new-sales-dashboard') },
        { text: 'Book Tutor', href: '/book-tutor.html', active: this.isActive('/book-tutor') },
        { text: 'My Bookings', href: '/sales-bookings.html', active: this.isActive('/sales-bookings') },
        { text: 'Available Tutors', href: '/book-tutor.html', active: this.isActive('/book-tutor') }
      ];
    } else if (role === 'admin') {
      return [
        { text: 'Dashboard', href: '/dashboard-admin.html', active: this.isActive('/dashboard-admin') },
        { text: 'All Bookings', href: '/admin-bookings.html', active: this.isActive('/admin-bookings') },
        { text: 'All Users', href: '/admin-users.html', active: this.isActive('/admin-users') },
        { text: 'Reports', href: '/admin-reports.html', active: this.isActive('/admin-reports') }
      ];
    }

    return baseItems;
  }

  isActive(path) {
    return window.location.pathname.endsWith(path);
  }

  /**
   * Render the navbar
   */
  renderNavbar() {
    const navbar = document.getElementById('navbar-container');
    if (!navbar) return;

    const navItems = this.getNavItems();
    const navHTML = `
      <nav class="navbar">
        <div class="navbar-container">
          <div class="navbar-left">
            <div class="navbar-brand">
              <a href="#" class="brand-link">📅 Tutor Scheduler</a>
            </div>
            <div class="navbar-menu">
              ${navItems.map(item => `
                <a href="${item.href}" class="nav-link ${item.active ? 'active' : ''}">
                  ${item.text}
                </a>
              `).join('')}
            </div>
          </div>
          <div class="navbar-right">
            <div class="navbar-user">
              <span class="user-role">${this.user.role?.toUpperCase()}</span>
              <span class="user-name">👤 ${this.user.name || 'User'}</span>
              <button class="btn-logout" onclick="navbarManager.logout()">Logout</button>
            </div>
          </div>
        </div>
      </nav>
    `;

    navbar.innerHTML = navHTML;
  }

  setupEventListeners() {
    // Add any navbar-specific event listeners here
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}'`
        }
      }).catch(() => {}); // Ignore errors
    } catch (e) {
      console.error('Logout error:', e);
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    return this.user.role === role;
  }

  /**
   * Redirect if unauthorized
   */
  requireRole(...roles) {
    if (!roles.includes(this.user.role)) {
      alert(`Access Denied: This page is for ${roles.join('/')} only`);
      window.location.href = this.getDefaultDashboard();
      return false;
    }
    return true;
  }

  getDefaultDashboard() {
    const { role } = this.user;
    if (role === 'tutor') return '/dashboard-tutor.html';
    if (role === 'sales') return '/dashboard-sales.html';
    if (role === 'admin') return '/admin-dashboard.html';
    return '/index.html';
  }

  /**
   * Update user info in navbar
   */
  updateUserInfo(user) {
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
    this.renderNavbar();
  }
}

// Initialize globally
const navbarManager = new NavbarManager();
