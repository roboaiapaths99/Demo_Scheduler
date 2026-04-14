// Notifications Management JavaScript
class NotificationManager {
    constructor() {
        this.baseURL = '/api/notifications';
        this.currentPage = 1;
        this.currentFilters = {};
        this.selectedNotifications = new Set();
        this.autoRefreshInterval = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUserData();
        await this.loadNotifications();
        await this.loadNotificationStats();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Set up filter change listeners
        const filterElements = ['filterType', 'filterRead', 'filterPriority'];
        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
            }
        });
    }

    startAutoRefresh() {
        // Auto-refresh notifications every 30 seconds
        this.autoRefreshInterval = setInterval(() => {
            this.loadNotifications(false); // Silent refresh
            this.updateUnreadCount();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'User';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadNotifications(showLoading = true) {
        try {
            if (showLoading) {
                this.showLoading();
            }

            const token = localStorage.getItem('accessToken');
            const queryParams = new URLSearchParams({
                ...this.currentFilters,
                page: this.currentPage
            }).toString();
            
            const response = await fetch(`${this.baseURL}?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderNotifications(result.data.notifications);
                this.renderPagination(result.data.pagination);
                this.updateQuickStats(result.data.notifications);
            } else {
                this.showMessage(result.message || 'Failed to load notifications', 'error');
            }
        } catch (error) {
            console.error('Load notifications error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async loadNotificationStats() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderStats(result.data.stats);
            }
        } catch (error) {
            console.error('Load notification stats error:', error);
        }
    }

    async updateUnreadCount() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.updateSummaryCard('unreadNotifications', result.data.unreadCount);
                
                // Update any notification bell indicators
                this.updateNotificationBell(result.data.unreadCount);
            }
        } catch (error) {
            console.error('Update unread count error:', error);
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No notifications</h3>
                    <p>You're all caught up! No new notifications to display.</p>
                    <button onclick="notificationManager.createTestNotification()" class="btn btn-outline">Create Test Notification</button>
                </div>
            `;
            return;
        }

        const html = notifications.map(notification => this.createNotificationItem(notification)).join('');
        container.innerHTML = html;
    }

    createNotificationItem(notification) {
        const isSelected = this.selectedNotifications.has(notification._id);
        
        return `
            <div class="notification-item ${notification.isRead ? '' : 'unread'} priority-${notification.priority} ${isSelected ? 'selected' : ''}" data-id="${notification._id}">
                <div class="notification-checkbox">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="notificationManager.toggleNotificationSelection('${notification._id}')">
                </div>
                <div class="notification-icon icon-${notification.icon}">
                    ${this.getNotificationIcon(notification.icon)}
                </div>
                <div class="notification-content">
                    <div class="notification-header">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-meta">
                            <span class="notification-time">${notification.formattedCreatedAt}</span>
                            <span class="notification-type type-${notification.type}">${this.formatNotificationType(notification.type)}</span>
                            <span class="notification-priority priority-${notification.priority}">${notification.priority}</span>
                        </div>
                    </div>
                    <div class="notification-message">${notification.message}</div>
                    ${notification.actionUrl ? `
                        <div class="notification-actions">
                            <a href="${notification.actionUrl}" class="notification-action-btn">${notification.actionText || 'View Details'}</a>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    getNotificationIcon(iconType) {
        const iconMap = {
            'calendar-plus': 'calendar-plus',
            'check-circle': 'check',
            'x-circle': 'x',
            'trash-2': 'trash',
            'calendar': 'calendar',
            'clock': 'clock',
            'check-square': 'check-square',
            'x-square': 'x-square',
            'plus-circle': 'plus',
            'edit': 'edit',
            'minus-circle': 'minus',
            'info': 'info',
            'bell': 'bell',
            'alert-triangle': 'alert-triangle',
            'alert-circle': 'alert'
        };
        
        // Simple text representation for now
        return iconMap[iconType] || '?';
    }

    formatNotificationType(type) {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    renderStats(stats) {
        this.updateSummaryCard('totalNotifications', stats.total);
        this.updateSummaryCard('unreadNotifications', stats.unread);
    }

    updateQuickStats(notifications) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const todayNotifications = notifications.filter(notification => {
            const notificationDate = new Date(notification.createdAt);
            return notificationDate >= today && notificationDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        }).length;

        const weekNotifications = notifications.filter(notification => {
            const notificationDate = new Date(notification.createdAt);
            return notificationDate >= today && notificationDate <= weekEnd;
        }).length;

        this.updateSummaryCard('todayNotifications', todayNotifications);
        this.updateSummaryCard('weekNotifications', weekNotifications);
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;

        const { current, total, hasNext, hasPrev } = pagination;
        
        let html = '';
        
        // Previous button
        html += `<button onclick="notificationManager.goToPage(${current - 1})" ${!hasPrev ? 'disabled' : ''}>Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= total; i++) {
            if (i === current || i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                html += `<button onclick="notificationManager.goToPage(${i})" class="${i === current ? 'active' : ''}">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += '<span>...</span>';
            }
        }
        
        // Next button
        html += `<button onclick="notificationManager.goToPage(${current + 1})" ${!hasNext ? 'disabled' : ''}>Next</button>`;
        
        // Info
        html += `<span class="pagination-info">Page ${current} of ${total}</span>`;
        
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadNotifications();
    }

    toggleNotificationSelection(notificationId) {
        if (this.selectedNotifications.has(notificationId)) {
            this.selectedNotifications.delete(notificationId);
        } else {
            this.selectedNotifications.add(notificationId);
        }
        
        this.updateBulkActionsBar();
        this.updateNotificationItemSelection(notificationId);
    }

    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('selectAll');
        const checkboxes = document.querySelectorAll('.notification-item input[type="checkbox"]');
        
        if (selectAllCheckbox.checked) {
            // Select all
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedNotifications.add(checkbox.closest('.notification-item').dataset.id);
            });
        } else {
            // Deselect all
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            this.selectedNotifications.clear();
        }
        
        this.updateBulkActionsBar();
        this.updateAllNotificationItemsSelection();
    }

    updateNotificationItemSelection(notificationId) {
        const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            if (this.selectedNotifications.has(notificationId)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        }
    }

    updateAllNotificationItemsSelection() {
        const items = document.querySelectorAll('.notification-item');
        items.forEach(item => {
            const notificationId = item.dataset.id;
            if (this.selectedNotifications.has(notificationId)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    updateBulkActionsBar() {
        // This would show/hide a bulk actions bar
        // For now, we'll just update the main action buttons
        const deleteButton = document.querySelector('.action-buttons .btn-danger');
        if (deleteButton) {
            deleteButton.disabled = this.selectedNotifications.size === 0;
            deleteButton.textContent = this.selectedNotifications.size > 0 ? 
                `Delete Selected (${this.selectedNotifications.size})` : 'Delete Selected';
        }
    }

    async markAsRead(notificationIds = null) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    notificationIds: notificationIds || Array.from(this.selectedNotifications) 
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Notifications marked as read', 'success');
                
                // Clear selection if marking selected as read
                if (!notificationIds) {
                    this.selectedNotifications.clear();
                    document.getElementById('selectAll').checked = false;
                }
                
                await this.loadNotifications();
                await this.updateUnreadCount();
            } else {
                this.showMessage(result.message || 'Failed to mark notifications as read', 'error');
            }
        } catch (error) {
            console.error('Mark as read error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async markAllAsRead() {
        if (!confirm('Are you sure you want to mark all notifications as read?')) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/mark-all-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('All notifications marked as read', 'success');
                this.selectedNotifications.clear();
                document.getElementById('selectAll').checked = false;
                await this.loadNotifications();
                await this.updateUnreadCount();
            } else {
                this.showMessage(result.message || 'Failed to mark all notifications as read', 'error');
            }
        } catch (error) {
            console.error('Mark all as read error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async deleteSelected() {
        if (this.selectedNotifications.size === 0) {
            this.showMessage('No notifications selected', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${this.selectedNotifications.size} selected notification(s)?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    notificationIds: Array.from(this.selectedNotifications) 
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Notifications deleted successfully', 'success');
                this.selectedNotifications.clear();
                document.getElementById('selectAll').checked = false;
                await this.loadNotifications();
                await this.updateUnreadCount();
            } else {
                this.showMessage(result.message || 'Failed to delete notifications', 'error');
            }
        } catch (error) {
            console.error('Delete notifications error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async createTestNotification() {
        const title = prompt('Enter notification title:');
        const message = prompt('Enter notification message:');
        
        if (!title || !message) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, message })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Test notification created successfully', 'success');
                await this.loadNotifications();
                await this.updateUnreadCount();
            } else {
                this.showMessage(result.message || 'Failed to create test notification', 'error');
            }
        } catch (error) {
            console.error('Create test notification error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    applyFilters() {
        const filters = {
            type: document.getElementById('filterType').value,
            isRead: document.getElementById('filterRead').value,
            priority: document.getElementById('filterPriority').value
        };

        // Remove empty filters
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        this.currentFilters = filters;
        this.currentPage = 1;
        this.loadNotifications();
    }

    clearFilters() {
        this.currentFilters = {};
        this.currentPage = 1;
        
        // Reset form
        document.getElementById('filterType').value = '';
        document.getElementById('filterRead').value = '';
        document.getElementById('filterPriority').value = '';
        
        this.loadNotifications();
    }

    async refreshNotifications() {
        await this.loadNotifications();
        await this.updateUnreadCount();
        this.showMessage('Notifications refreshed', 'success');
    }

    updateNotificationBell(unreadCount) {
        // Update any notification bell icons in the UI
        const bellIndicators = document.querySelectorAll('.notification-bell');
        bellIndicators.forEach(indicator => {
            if (unreadCount > 0) {
                indicator.classList.add('has-unread');
                indicator.setAttribute('data-count', unreadCount);
            } else {
                indicator.classList.remove('has-unread');
                indicator.removeAttribute('data-count');
            }
        });
    }

    showLoading() {
        const container = document.getElementById('notificationsList');
        if (container) {
            container.innerHTML = '<div class="loading">Loading notifications...</div>';
        }
    }

    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    showMessage(message, type) {
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `message ${type}`;
            messageElement.style.display = 'block';

            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }
}

// Logout function
window.logout = function() {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    window.location.href = 'index.html';
};

// Initialize notification manager
const notificationManager = new NotificationManager();
