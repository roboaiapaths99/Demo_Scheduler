// Bookings Management JavaScript
class BookingsManager {
    constructor() {
        this.baseURL = '/api/bookings';
        this.currentFilters = {};
        this.currentPage = 1;
        this.userRole = '';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUserData();
        await this.loadBookings();
        await this.loadStats();
        this.setDefaultDates();
    }

    setupEventListeners() {
        // Cancel form
        const cancelForm = document.getElementById('cancelForm');
        if (cancelForm) {
            cancelForm.addEventListener('submit', this.handleCancelBooking.bind(this));
        }

        // Set minimum date for filters
        this.setMinDates();
    }

    setMinDates() {
        const today = new Date().toISOString().split('T')[0];
        
        const dateInputs = [
            'filterStartDate',
            'filterEndDate'
        ];
        
        dateInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input && input.type === 'date') {
                input.min = today;
            }
        });
    }

    setDefaultDates() {
        const today = new Date();
        const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // Set default filter dates (next 30 days)
        const startDateInput = document.getElementById('filterStartDate');
        const endDateInput = document.getElementById('filterEndDate');
        
        if (startDateInput && !startDateInput.value) {
            startDateInput.value = today.toISOString().split('T')[0];
        }
        if (endDateInput && !endDateInput.value) {
            endDateInput.value = nextMonth.toISOString().split('T')[0];
        }
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            this.userRole = user.role || '';
            
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'User';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadBookings() {
        try {
            const token = localStorage.getItem('accessToken');
            const endpoint = this.userRole === 'tutor' ? '/tutor' : '/sales';
            const queryParams = new URLSearchParams({
                ...this.currentFilters,
                page: this.currentPage
            }).toString();
            
            const response = await fetch(`${this.baseURL}${endpoint}?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderBookingsList(result.data.bookings);
                this.renderPagination(result.data.pagination);
            } else {
                this.showMessage(result.message || 'Failed to load bookings', 'error');
            }
        } catch (error) {
            console.error('Load bookings error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async loadStats() {
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
            console.error('Load stats error:', error);
        }
    }

    renderStats(stats) {
        const statsData = {
            total: 0,
            pending: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0
        };

        stats.forEach(stat => {
            statsData.total += stat.count;
            if (stat._id === 'pending') statsData.pending = stat.count;
            if (stat._id === 'confirmed') statsData.confirmed = stat.count;
            if (stat._id === 'completed') statsData.completed = stat.count;
            if (stat._id === 'cancelled') statsData.cancelled = stat.count;
        });

        this.updateSummaryCard('totalBookings', statsData.total);
        this.updateSummaryCard('pendingBookings', statsData.pending);
        this.updateSummaryCard('confirmedBookings', statsData.confirmed);
        this.updateSummaryCard('completedBookings', statsData.completed);
    }

    renderBookingsList(bookings) {
        const container = document.getElementById('bookingsList');
        if (!container) return;

        if (bookings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No bookings found</h3>
                    <p>Try adjusting your filters or check back later.</p>
                </div>
            `;
            return;
        }

        const html = bookings.map(booking => this.createBookingItem(booking)).join('');
        container.innerHTML = html;
    }

    createBookingItem(booking) {
        const isUpcoming = booking.isUpcoming;
        const isModifiable = booking.isModifiable;
        
        return `
            <div class="booking-item ${booking.status}">
                <div class="booking-header">
                    <div class="booking-main-info">
                        ${this.userRole === 'sales' ? 
                            `<div class="booking-client">${booking.clientName}</div>` :
                            `<div class="booking-client">Session with ${booking.clientName}</div>`
                        }
                        <div class="booking-datetime">
                            ${booking.formattedDateTime}
                            <span class="booking-duration">${booking.duration} min</span>
                            <span class="booking-status ${booking.status}">${booking.status}</span>
                        </div>
                        <div class="booking-details-info">
                            ${this.userRole === 'sales' ? 
                                `<p><strong>Tutor:</strong> ${booking.tutorName || 'Not assigned'}</p>` :
                                `<p><strong>Sales Rep:</strong> ${booking.salesName || 'Not assigned'}</p>`
                            }
                            ${booking.clientPhone ? `<p><strong>Phone:</strong> ${booking.clientPhone}</p>` : ''}
                            ${booking.clientEmail ? `<p><strong>Email:</strong> ${booking.clientEmail}</p>` : ''}
                        </div>
                    </div>
                    <div class="booking-actions ${this.userRole === 'tutor' ? 'booking-actions-vertical' : ''}">
                        <button onclick="bookingsManager.viewBooking('${booking._id}')" class="btn btn-view btn-sm">View Details</button>
                        
                        ${this.userRole === 'sales' && booking.status === 'pending' && isUpcoming ? 
                            `<button onclick="bookingsManager.cancelBooking('${booking._id}')" class="btn btn-cancel btn-sm">Cancel</button>` : ''
                        }
                        
                        ${this.userRole === 'tutor' && booking.status === 'pending' && isUpcoming ? 
                            `<button onclick="bookingsManager.respondToBooking('${booking._id}', 'accepted')" class="btn btn-confirm btn-sm">Accept</button>
                             <button onclick="bookingsManager.respondToBooking('${booking._id}', 'rejected')" class="btn btn-cancel btn-sm">Reject</button>` : ''
                        }
                        
                        ${this.userRole === 'tutor' && booking.status === 'confirmed' && isUpcoming ? 
                            `<button onclick="bookingsManager.completeBooking('${booking._id}')" class="btn btn-complete btn-sm">Mark Complete</button>` : ''
                        }
                    </div>
                </div>
            </div>
        `;
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;

        const { current, total, hasNext, hasPrev } = pagination;
        
        let html = '';
        
        // Previous button
        html += `<button onclick="bookingsManager.goToPage(${current - 1})" ${!hasPrev ? 'disabled' : ''}>Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= total; i++) {
            if (i === current || i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                html += `<button onclick="bookingsManager.goToPage(${i})" class="${i === current ? 'active' : ''}">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += '<span>...</span>';
            }
        }
        
        // Next button
        html += `<button onclick="bookingsManager.goToPage(${current + 1})" ${!hasNext ? 'disabled' : ''}>Next</button>`;
        
        // Info
        html += `<span class="pagination-info">Page ${current} of ${total}</span>`;
        
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadBookings();
    }

    async viewBooking(bookingId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showBookingModal(result.data.booking);
            } else {
                this.showMessage(result.message || 'Failed to load booking details', 'error');
            }
        } catch (error) {
            console.error('View booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    showBookingModal(booking) {
        const modal = document.getElementById('bookingModal');
        const container = document.getElementById('bookingDetails');
        
        const html = `
            <div class="booking-detail-section">
                <h4>Session Information</h4>
                <div class="booking-detail-grid">
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Client Name</span>
                        <span class="booking-detail-value">${booking.clientName}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Date & Time</span>
                        <span class="booking-detail-value">${booking.formattedDateTime}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Duration</span>
                        <span class="booking-detail-value">${booking.duration} minutes</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Status</span>
                        <span class="booking-detail-value">
                            <span class="booking-status ${booking.status}">${booking.status}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div class="booking-detail-section">
                <h4>Contact Information</h4>
                <div class="booking-detail-grid">
                    ${booking.clientPhone ? `
                        <div class="booking-detail-item">
                            <span class="booking-detail-label">Phone</span>
                            <span class="booking-detail-value">${booking.clientPhone}</span>
                        </div>
                    ` : ''}
                    ${booking.clientEmail ? `
                        <div class="booking-detail-item">
                            <span class="booking-detail-label">Email</span>
                            <span class="booking-detail-value">${booking.clientEmail}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="booking-detail-section">
                <h4>Participants</h4>
                <div class="booking-detail-grid">
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Tutor</span>
                        <span class="booking-detail-value">${booking.tutorId?.name || 'Not assigned'}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Sales Representative</span>
                        <span class="booking-detail-value">${booking.salesId?.name || 'Not assigned'}</span>
                    </div>
                </div>
            </div>

            ${booking.clientNotes ? `
                <div class="booking-detail-section">
                    <h4>Client Notes</h4>
                    <p>${booking.clientNotes}</p>
                </div>
            ` : ''}

            ${booking.notes ? `
                <div class="booking-detail-section">
                    <h4>Session Notes</h4>
                    <p>${booking.notes}</p>
                </div>
            ` : ''}

            <div class="booking-detail-section">
                <h4>Booking Information</h4>
                <div class="booking-detail-grid">
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Created</span>
                        <span class="booking-detail-value">${new Date(booking.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Last Updated</span>
                        <span class="booking-detail-value">${new Date(booking.updatedAt).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        modal.style.display = 'flex';
    }

    closeBookingModal() {
        const modal = document.getElementById('bookingModal');
        modal.style.display = 'none';
    }

    cancelBooking(bookingId) {
        const modal = document.getElementById('cancelModal');
        const bookingIdInput = document.getElementById('cancelBookingId');
        
        bookingIdInput.value = bookingId;
        modal.style.display = 'flex';
        
        // Load booking info for display
        this.loadCancelBookingInfo(bookingId);
    }

    async loadCancelBookingInfo(bookingId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const booking = result.data.booking;
                const container = document.getElementById('cancelBookingInfo');
                
                container.innerHTML = `
                    <p><strong>Client:</strong> ${booking.clientName}</p>
                    <p><strong>Date & Time:</strong> ${booking.formattedDateTime}</p>
                    <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                `;
            }
        } catch (error) {
            console.error('Load cancel booking info error:', error);
        }
    }

    closeCancelModal() {
        const modal = document.getElementById('cancelModal');
        modal.style.display = 'none';
        document.getElementById('cancelForm').reset();
    }

    async handleCancelBooking(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const bookingId = data.id;
        
        if (!data.reason || data.reason.trim().length < 10) {
            this.showMessage('Please provide a cancellation reason (minimum 10 characters)', 'error');
            return;
        }

        const button = e.target.querySelector('button[type="submit"]');
        this.setLoadingState(button, true, 'Cancelling...');

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason: data.reason })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Booking cancelled successfully', 'success');
                this.closeCancelModal();
                await this.loadBookings();
                await this.loadStats();
            } else {
                this.showMessage(result.message || 'Failed to cancel booking', 'error');
            }
        } catch (error) {
            console.error('Cancel booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoadingState(button, false, 'Cancel Booking');
        }
    }

    async respondToBooking(bookingId, response) {
        try {
            const token = localStorage.getItem('accessToken');
            const apiResponse = await fetch(`${this.baseURL}/${bookingId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ response })
            });

            const result = await apiResponse.json();

            if (result.success) {
                this.showMessage(`Booking ${response} successfully`, 'success');
                await this.loadBookings();
                await this.loadStats();
            } else {
                this.showMessage(result.message || `Failed to ${response} booking`, 'error');
            }
        } catch (error) {
            console.error('Respond to booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async completeBooking(bookingId) {
        if (!confirm('Are you sure you want to mark this booking as completed?')) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/${bookingId}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Booking marked as completed', 'success');
                await this.loadBookings();
                await this.loadStats();
            } else {
                this.showMessage(result.message || 'Failed to complete booking', 'error');
            }
        } catch (error) {
            console.error('Complete booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    applyFilters() {
        const filters = {
            startDate: document.getElementById('filterStartDate').value,
            endDate: document.getElementById('filterEndDate').value,
            status: document.getElementById('filterStatus').value
        };

        // Remove empty filters
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        this.currentFilters = filters;
        this.currentPage = 1;
        this.loadBookings();
    }

    clearFilters() {
        this.currentFilters = {};
        this.currentPage = 1;
        
        // Reset form
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterStatus').value = '';
        
        this.setDefaultDates();
        this.loadBookings();
    }

    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    setLoadingState(button, isLoading, text) {
        if (isLoading) {
            button.disabled = true;
            button.textContent = text;
        } else {
            button.disabled = false;
            button.textContent = text;
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

// Initialize bookings manager
const bookingsManager = new BookingsManager();
