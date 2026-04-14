// Pending Bookings Management JavaScript
class PendingBookingsManager {
    constructor() {
        this.baseURL = '/api/tutor-response';
        this.currentPage = 1;
        this.currentBookingId = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUserData();
        await this.loadPendingBookings();
        await this.loadResponseStats();
        this.setMinDates();
        
        // Set up auto-refresh for new bookings
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Reject form
        const rejectForm = document.getElementById('rejectForm');
        if (rejectForm) {
            rejectForm.addEventListener('submit', this.handleRejectBooking.bind(this));
        }

        // Reschedule form
        const rescheduleForm = document.getElementById('rescheduleForm');
        if (rescheduleForm) {
            rescheduleForm.addEventListener('submit', this.handleReschedule.bind(this));
        }

        // Set minimum date for reschedule
        this.setMinDates();
    }

    setMinDates() {
        const today = new Date().toISOString().split('T')[0];
        const newDateInput = document.getElementById('newDate');
        if (newDateInput) {
            newDateInput.min = today;
        }
    }

    startAutoRefresh() {
        // Refresh pending bookings every 30 seconds
        setInterval(() => {
            this.loadPendingBookings();
        }, 30000);
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'Tutor';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadPendingBookings() {
        try {
            const token = localStorage.getItem('accessToken');
            const queryParams = new URLSearchParams({
                page: this.currentPage
            }).toString();
            
            const response = await fetch(`${this.baseURL}/pending?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderPendingBookings(result.data.bookings);
                this.renderPagination(result.data.pagination);
                this.updateQuickStats(result.data.bookings);
            } else {
                this.showMessage(result.message || 'Failed to load pending bookings', 'error');
            }
        } catch (error) {
            console.error('Load pending bookings error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async loadResponseStats() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/stats/response`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderResponseStats(result.data.stats, result.data.responseTimeStats);
            }
        } catch (error) {
            console.error('Load response stats error:', error);
        }
    }

    renderResponseStats(stats, responseTimeStats) {
        const statsData = {
            pending: 0,
            accepted: 0,
            rejected: 0
        };

        stats.forEach(stat => {
            if (stat._id === 'pending') statsData.pending = stat.count;
            if (stat._id === 'accepted') statsData.accepted = stat.count;
            if (stat._id === 'rejected') statsData.rejected = stat.count;
        });

        this.updateSummaryCard('pendingCount', statsData.pending);
        this.updateSummaryCard('avgResponseTime', this.formatResponseTime(responseTimeStats.avgResponseTime));
    }

    formatResponseTime(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return `${hours}h ${mins}m`;
        }
    }

    updateQuickStats(bookings) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const todayCount = bookings.filter(booking => {
            const bookingDate = new Date(booking.scheduledAt);
            return bookingDate >= today && bookingDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        }).length;

        const weekCount = bookings.filter(booking => {
            const bookingDate = new Date(booking.scheduledAt);
            return bookingDate >= today && bookingDate <= weekEnd;
        }).length;

        this.updateSummaryCard('todayCount', todayCount);
        this.updateSummaryCard('weekCount', weekCount);
    }

    renderPendingBookings(bookings) {
        const container = document.getElementById('pendingBookingsList');
        if (!container) return;

        if (bookings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No pending bookings</h3>
                    <p>Great! You don't have any pending bookings to respond to.</p>
                    <div>
                        <a href="dashboard-tutor.html" class="btn btn-primary">View Dashboard</a>
                        <a href="bookings.html" class="btn btn-secondary">All Bookings</a>
                    </div>
                </div>
            `;
            return;
        }

        const html = bookings.map(booking => this.createPendingBookingItem(booking)).join('');
        container.innerHTML = html;
    }

    createPendingBookingItem(booking) {
        const age = this.calculateAge(booking.createdAt);
        const isUrgent = age > 24; // Urgent if older than 24 hours
        const priority = this.getPriority(booking, age);

        return `
            <div class="pending-booking-item ${isUrgent ? 'urgent' : ''} priority-${priority}">
                <div class="pending-booking-header">
                    <div class="pending-booking-main-info">
                        <div class="pending-booking-client">
                            ${booking.clientName}
                            <span class="status-pill ${isUrgent ? 'urgent' : 'new'}">${isUrgent ? 'URGENT' : 'NEW'}</span>
                        </div>
                        <div class="pending-booking-datetime">
                            ${booking.formattedDateTime}
                            <span class="pending-booking-duration">${booking.duration} min</span>
                            <span class="pending-booking-age">${age}h ago</span>
                        </div>
                        <div class="pending-booking-details-info">
                            <p><strong>Sales Rep:</strong> ${booking.salesName || 'Not assigned'}</p>
                            ${booking.clientPhone ? `<p><strong>Phone:</strong> ${booking.clientPhone}</p>` : ''}
                            ${booking.clientEmail ? `<p><strong>Email:</strong> ${booking.clientEmail}</p>` : ''}
                            ${booking.clientNotes ? `<p><strong>Notes:</strong> ${booking.clientNotes}</p>` : ''}
                        </div>
                    </div>
                    <div class="pending-booking-actions-vertical">
                        <button onclick="pendingBookings.viewBooking('${booking._id}')" class="btn btn-view btn-sm">View Details</button>
                        <button onclick="pendingBookings.acceptBooking('${booking._id}')" class="btn btn-accept btn-sm">Accept</button>
                        <button onclick="pendingBookings.rejectBooking('${booking._id}')" class="btn btn-reject btn-sm">Reject</button>
                        <button onclick="pendingBookings.rescheduleBooking('${booking._id}')" class="btn btn-reschedule btn-sm">Reschedule</button>
                    </div>
                </div>
            </div>
        `;
    }

    calculateAge(createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
        const hoursDiff = (now - created) / (1000 * 60 * 60);
        return Math.floor(hoursDiff);
    }

    getPriority(booking, age) {
        if (age > 24) return 'high';
        if (age > 12) return 'medium';
        return 'low';
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;

        const { current, total, hasNext, hasPrev } = pagination;
        
        let html = '';
        
        // Previous button
        html += `<button onclick="pendingBookings.goToPage(${current - 1})" ${!hasPrev ? 'disabled' : ''}>Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= total; i++) {
            if (i === current || i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                html += `<button onclick="pendingBookings.goToPage(${i})" class="${i === current ? 'active' : ''}">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += '<span>...</span>';
            }
        }
        
        // Next button
        html += `<button onclick="pendingBookings.goToPage(${current + 1})" ${!hasNext ? 'disabled' : ''}>Next</button>`;
        
        // Info
        html += `<span class="pagination-info">Page ${current} of ${total}</span>`;
        
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadPendingBookings();
    }

    viewBooking(bookingId) {
        // For now, just show a simple message
        this.showMessage('Booking details view coming soon!', 'info');
    }

    acceptBooking(bookingId) {
        const modal = document.getElementById('acceptModal');
        this.currentBookingId = bookingId;
        
        // Load booking info for display
        this.loadAcceptBookingInfo(bookingId);
        modal.style.display = 'flex';
    }

    async loadAcceptBookingInfo(bookingId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/pending`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const booking = result.data.bookings.find(b => b._id === bookingId);
                if (booking) {
                    const container = document.getElementById('acceptBookingInfo');
                    container.innerHTML = `
                        <p><strong>Client:</strong> ${booking.clientName}</p>
                        <p><strong>Date & Time:</strong> ${booking.formattedDateTime}</p>
                        <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                        <p><strong>Sales Rep:</strong> ${booking.salesName}</p>
                    `;
                }
            }
        } catch (error) {
            console.error('Load accept booking info error:', error);
        }
    }

    closeAcceptModal() {
        const modal = document.getElementById('acceptModal');
        modal.style.display = 'none';
        this.currentBookingId = null;
    }

    async confirmAccept() {
        if (!this.currentBookingId) return;

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${this.currentBookingId}/accept`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Booking accepted successfully!', 'success');
                this.closeAcceptModal();
                await this.loadPendingBookings();
                await this.loadResponseStats();
            } else {
                this.showMessage(result.message || 'Failed to accept booking', 'error');
            }
        } catch (error) {
            console.error('Accept booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    rejectBooking(bookingId) {
        const modal = document.getElementById('rejectModal');
        const bookingIdInput = document.getElementById('rejectBookingId');
        
        bookingIdInput.value = bookingId;
        this.currentBookingId = bookingId;
        modal.style.display = 'flex';
        
        // Load booking info for display
        this.loadRejectBookingInfo(bookingId);
    }

    async loadRejectBookingInfo(bookingId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/pending`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const booking = result.data.bookings.find(b => b._id === bookingId);
                if (booking) {
                    const container = document.getElementById('rejectBookingInfo');
                    container.innerHTML = `
                        <p><strong>Client:</strong> ${booking.clientName}</p>
                        <p><strong>Date & Time:</strong> ${booking.formattedDateTime}</p>
                        <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                    `;
                }
            }
        } catch (error) {
            console.error('Load reject booking info error:', error);
        }
    }

    closeRejectModal() {
        const modal = document.getElementById('rejectModal');
        modal.style.display = 'none';
        document.getElementById('rejectForm').reset();
        this.currentBookingId = null;
    }

    async handleRejectBooking(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        if (!data.reason || data.reason.trim().length < 10) {
            this.showMessage('Please provide a rejection reason (minimum 10 characters)', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${this.currentBookingId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason: data.reason })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Booking rejected successfully', 'success');
                this.closeRejectModal();
                await this.loadPendingBookings();
                await this.loadResponseStats();
            } else {
                this.showMessage(result.message || 'Failed to reject booking', 'error');
            }
        } catch (error) {
            console.error('Reject booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    rescheduleBooking(bookingId) {
        const modal = document.getElementById('rescheduleModal');
        const bookingIdInput = document.getElementById('rescheduleBookingId');
        
        bookingIdInput.value = bookingId;
        this.currentBookingId = bookingId;
        modal.style.display = 'flex';
        
        // Load booking info for display
        this.loadRescheduleBookingInfo(bookingId);
    }

    async loadRescheduleBookingInfo(bookingId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/pending`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const booking = result.data.bookings.find(b => b._id === bookingId);
                if (booking) {
                    const container = document.getElementById('rescheduleBookingInfo');
                    container.innerHTML = `
                        <p><strong>Client:</strong> ${booking.clientName}</p>
                        <p><strong>Current Time:</strong> ${booking.formattedDateTime}</p>
                        <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                    `;
                }
            }
        } catch (error) {
            console.error('Load reschedule booking info error:', error);
        }
    }

    closeRescheduleModal() {
        const modal = document.getElementById('rescheduleModal');
        modal.style.display = 'none';
        document.getElementById('rescheduleForm').reset();
        this.currentBookingId = null;
    }

    async handleReschedule(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        if (!this.validateRescheduleForm(data)) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${this.currentBookingId}/reschedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Reschedule request sent successfully!', 'success');
                this.closeRescheduleModal();
                await this.loadPendingBookings();
                await this.loadResponseStats();
            } else {
                this.showMessage(result.message || 'Failed to send reschedule request', 'error');
            }
        } catch (error) {
            console.error('Reschedule error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    validateRescheduleForm(data) {
        if (!data.newDate || !data.newStartTime || !data.newEndTime) {
            this.showMessage('Please fill in all reschedule fields', 'error');
            return false;
        }

        if (data.newStartTime >= data.newEndTime) {
            this.showMessage('End time must be after start time', 'error');
            return false;
        }

        if (!data.reason || data.reason.trim().length < 10) {
            this.showMessage('Please provide a reason for reschedule (minimum 10 characters)', 'error');
            return false;
        }

        return true;
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

// Initialize pending bookings manager
const pendingBookings = new PendingBookingsManager();
