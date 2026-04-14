// Notification Bell Component - Can be included in any page
class NotificationBell {
    constructor() {
        this.baseURL = '/api/notifications';
        this.unreadCount = 0;
        this.isOpen = false;
        this.notifications = [];
        this.init();
    }

    init() {
        this.createBellHTML();
        this.setupEventListeners();
        this.loadUnreadCount();
        this.startAutoRefresh();
    }

    createBellHTML() {
        // Create notification bell HTML
        const bellHTML = `
            <div class="notification-bell-container">
                <button class="notification-bell" id="notificationBell">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
                </button>
                
                <div class="notification-dropdown" id="notificationDropdown">
                    <div class="notification-dropdown-header">
                        <h3>Notifications</h3>
                        <button class="mark-all-read-btn" onclick="notificationBell.markAllAsRead()">Mark all as read</button>
                    </div>
                    <div class="notification-dropdown-content" id="notificationDropdownContent">
                        <div class="loading">Loading notifications...</div>
                    </div>
                    <div class="notification-dropdown-footer">
                        <a href="notifications.html" class="view-all-link">View all notifications</a>
                    </div>
                </div>
            </div>
        `;

        // Add to header user info area
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.insertAdjacentHTML('afterbegin', bellHTML);
        }

        // Add CSS styles
        this.addBellStyles();
    }

    addBellStyles() {
        const styles = `
            .notification-bell-container {
                position: relative;
                margin-right: 15px;
            }
            
            .notification-bell {
                position: relative;
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                border-radius: 50%;
                transition: all 0.3s ease;
                color: rgba(255, 255, 255, 0.8);
            }
            
            .notification-bell:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            .notification-bell.has-unread {
                color: #ffc107;
            }
            
            .notification-badge {
                position: absolute;
                top: 0;
                right: 0;
                background: #dc3545;
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                font-size: 10px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 18px;
            }
            
            .notification-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                width: 350px;
                max-height: 400px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                z-index: 1000;
                display: none;
                overflow: hidden;
            }
            
            .notification-dropdown.show {
                display: block;
            }
            
            .notification-dropdown-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid #e1e5e9;
                background: #f8f9fa;
            }
            
            .notification-dropdown-header h3 {
                margin: 0;
                color: #333;
                font-size: 1rem;
            }
            
            .mark-all-read-btn {
                background: none;
                border: none;
                color: #667eea;
                cursor: pointer;
                font-size: 0.8rem;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.3s ease;
            }
            
            .mark-all-read-btn:hover {
                background: #667eea;
                color: white;
            }
            
            .notification-dropdown-content {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .notification-dropdown-item {
                padding: 12px 15px;
                border-bottom: 1px solid #f1f3f4;
                cursor: pointer;
                transition: background 0.3s ease;
            }
            
            .notification-dropdown-item:hover {
                background: #f8f9fa;
            }
            
            .notification-dropdown-item.unread {
                background: #e8f5e8;
                border-left: 3px solid #28a745;
            }
            
            .notification-dropdown-title {
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
                font-size: 0.9rem;
            }
            
            .notification-dropdown-message {
                color: #666;
                font-size: 0.8rem;
                margin-bottom: 4px;
                line-height: 1.4;
            }
            
            .notification-dropdown-time {
                color: #999;
                font-size: 0.7rem;
            }
            
            .notification-dropdown-footer {
                padding: 10px 15px;
                text-align: center;
                border-top: 1px solid #e1e5e9;
                background: #f8f9fa;
            }
            
            .view-all-link {
                color: #667eea;
                text-decoration: none;
                font-size: 0.9rem;
                font-weight: 500;
            }
            
            .view-all-link:hover {
                text-decoration: underline;
            }
            
            .no-notifications {
                text-align: center;
                padding: 30px 15px;
                color: #666;
            }
            
            .no-notifications svg {
                width: 40px;
                height: 40px;
                margin-bottom: 10px;
                opacity: 0.5;
            }
            
            @media (max-width: 768px) {
                .notification-dropdown {
                    width: 300px;
                    right: -10px;
                }
            }
        `;

        // Add styles to head
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    setupEventListeners() {
        const bell = document.getElementById('notificationBell');
        const dropdown = document.getElementById('notificationDropdown');

        if (bell) {
            bell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !dropdown.contains(e.target) && !bell.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Prevent dropdown from closing when clicking inside
        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    async openDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        const bell = document.getElementById('notificationBell');
        
        if (dropdown) {
            dropdown.classList.add('show');
            this.isOpen = true;
            bell.classList.add('active');
            
            // Load notifications when opening
            await this.loadRecentNotifications();
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        const bell = document.getElementById('notificationBell');
        
        if (dropdown) {
            dropdown.classList.remove('show');
            this.isOpen = false;
            bell.classList.remove('active');
        }
    }

    async loadUnreadCount() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.updateUnreadCount(result.data.unreadCount);
            }
        } catch (error) {
            console.error('Load unread count error:', error);
        }
    }

    async loadRecentNotifications() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}?limit=5`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderDropdownNotifications(result.data.notifications);
            }
        } catch (error) {
            console.error('Load recent notifications error:', error);
        }
    }

    renderDropdownNotifications(notifications) {
        const container = document.getElementById('notificationDropdownContent');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="no-notifications">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }

        const html = notifications.map(notification => `
            <div class="notification-dropdown-item ${notification.isRead ? '' : 'unread'}" onclick="notificationBell.handleNotificationClick('${notification._id}', '${notification.actionUrl || ''}')">
                <div class="notification-dropdown-title">${notification.title}</div>
                <div class="notification-dropdown-message">${notification.message}</div>
                <div class="notification-dropdown-time">${notification.formattedCreatedAt}</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    handleNotificationClick(notificationId, actionUrl) {
        // Mark as read
        this.markAsRead(notificationId);
        
        // Navigate to action URL if provided
        if (actionUrl) {
            window.location.href = actionUrl;
        }
        
        // Close dropdown
        this.closeDropdown();
    }

    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('accessToken');
            await fetch(`${this.baseURL}/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notificationIds: [notificationId] })
            });

            // Update unread count
            this.loadUnreadCount();
        } catch (error) {
            console.error('Mark as read error:', error);
        }
    }

    async markAllAsRead() {
        try {
            const token = localStorage.getItem('accessToken');
            await fetch(`${this.baseURL}/mark-all-read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Update UI
            this.updateUnreadCount(0);
            this.loadRecentNotifications();
        } catch (error) {
            console.error('Mark all as read error:', error);
        }
    }

    updateUnreadCount(count) {
        this.unreadCount = count;
        const badge = document.getElementById('notificationBadge');
        const bell = document.getElementById('notificationBell');

        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
                bell.classList.add('has-unread');
            } else {
                badge.style.display = 'none';
                bell.classList.remove('has-unread');
            }
        }
    }

    startAutoRefresh() {
        // Refresh unread count every 30 seconds
        setInterval(() => {
            this.loadUnreadCount();
        }, 30000);
    }
}

// Initialize notification bell when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('accessToken');
    if (token) {
        window.notificationBell = new NotificationBell();
    }
});
