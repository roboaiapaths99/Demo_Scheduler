// Sales Dashboard JavaScript
class SalesDashboard {
    constructor() {
        this.baseURL = '/api/sales';
        this.currentView = 'list';
        this.currentFilters = {};
        this.currentPage = 1;
        this.tutors = [];
        this.init();
    }

    async init() {
        // Check access control
        this.checkAccess();
        
        this.setupEventListeners();
        await this.loadUserData();
        await this.loadTutors();
        await this.loadStats();
        await this.loadAvailableSlots();
        this.setDefaultDates();
        // Auto-refresh every 30 seconds for real-time sync
        setInterval(() => {
            this.loadAvailableSlots();
            this.loadStats();
        }, 30000);
    }

    setupEventListeners() {
        // Booking form
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('submit', this.handleBooking.bind(this));
        }

        // Set minimum date for filters
        this.setMinDates();
        
        // Update navbar with username
        this.updateNavbar();
    }

    checkAccess() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('accessToken');

        if (!token) {
            window.location.href = '/index.html';
            return;
        }

        if (user.role !== 'sales') {
            alert('Access Denied: This page is only for Sales Team');
            window.location.href = user.role === 'tutor' ? '/dashboard-tutor.html' : '/index.html';
            return;
        }
    }

    updateNavbar() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const navUserName = document.getElementById('navUserName');
        if (navUserName) {
            navUserName.textContent = `👤 ${user.name || 'Sales Team'}`;
        }
    }

    setMinDates() {
        const today = new Date().toISOString().split('T')[0];
        
        const dateInputs = [
            'filterStartDate',
            'filterEndDate',
            'calendarMonth',
            'statsStartDate',
            'statsEndDate'
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
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        // Set default filter dates (next 7 days)
        const startDateInput = document.getElementById('filterStartDate');
        const endDateInput = document.getElementById('filterEndDate');
        
        if (startDateInput && !startDateInput.value) {
            startDateInput.value = today.toISOString().split('T')[0];
        }
        if (endDateInput && !endDateInput.value) {
            endDateInput.value = nextWeek.toISOString().split('T')[0];
        }

        // Set default calendar month
        const calendarMonthInput = document.getElementById('calendarMonth');
        if (calendarMonthInput && !calendarMonthInput.value) {
            calendarMonthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
    }

    async loadUserData() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'Sales Team';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadTutors() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/slots`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.tutors = result.data.tutors;
                this.populateTutorSelects();
            }
        } catch (error) {
            console.error('Load tutors error:', error);
        }
    }

    populateTutorSelects() {
        const selects = ['filterTutor', 'calendarTutor'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                // Clear existing options (except first)
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }
                
                // Add tutor options
                this.tutors.forEach(tutor => {
                    const option = document.createElement('option');
                    option.value = tutor._id;
                    option.textContent = tutor.name;
                    select.appendChild(option);
                });
            }
        });
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
                this.renderOverviewStats(result.data.stats);
                this.renderTutorStats(result.data.tutorStats);
                this.renderDailyStats(result.data.dailyStats);
            }
        } catch (error) {
            console.error('Load stats error:', error);
        }
    }

    renderOverviewStats(stats) {
        const statsData = {
            totalAvailable: 0,
            totalBooked: 0,
            totalHours: 0
        };

        stats.forEach(stat => {
            if (stat._id === 'available') statsData.totalAvailable = stat.count;
            if (stat._id === 'booked') statsData.totalBooked = stat.count;
            statsData.totalHours += stat.totalHours || 0;
        });

        this.updateSummaryCard('totalAvailable', statsData.totalAvailable);
        this.updateSummaryCard('activeTutors', this.tutors.length);
        
        // Calculate today's slots (simplified)
        const today = new Date().toISOString().split('T')[0];
        const todaySlots = statsData.totalAvailable / 7; // Rough estimate
        this.updateSummaryCard('todaySlots', Math.round(todaySlots));
        this.updateSummaryCard('weekSlots', statsData.totalAvailable);
    }

    renderTutorStats(tutorStats) {
        const container = document.getElementById('tutorStats');
        if (!container) return;

        if (tutorStats.length === 0) {
            container.innerHTML = '<div class="loading">No tutor statistics available</div>';
            return;
        }

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>Tutor Name</th>
                        <th>Email</th>
                        <th>Available Slots</th>
                        <th>Total Hours</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
                    ${tutorStats.map(tutor => `
                        <tr>
                            <td>${tutor.tutorName}</td>
                            <td>${tutor.tutorEmail}</td>
                            <td>${tutor.availableSlots}</td>
                            <td>${tutor.totalHours}h</td>
                            <td>
                                <span class="tutor-performance-badge ${this.getPerformanceBadge(tutor.availableSlots)}">
                                    ${this.getPerformanceLabel(tutor.availableSlots)}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    renderDailyStats(dailyStats) {
        const container = document.getElementById('dailyStats');
        if (!container) return;

        if (dailyStats.length === 0) {
            container.innerHTML = '<div class="loading">No daily statistics available</div>';
            return;
        }

        const html = dailyStats.map(day => `
            <div class="daily-stat-item">
                <div class="daily-date">${this.formatDate(day.date)}</div>
                <div class="daily-slots">${day.slots}</div>
                <div class="daily-tutors">${day.tutorCount} tutors</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    getPerformanceBadge(slots) {
        if (slots >= 20) return 'badge-high';
        if (slots >= 10) return 'badge-medium';
        return 'badge-low';
    }

    getPerformanceLabel(slots) {
        if (slots >= 20) return 'High';
        if (slots >= 10) return 'Medium';
        return 'Low';
    }

    async loadAvailableSlots() {
        try {
            const token = localStorage.getItem('accessToken');
            const queryParams = new URLSearchParams(this.currentFilters).toString();

            const response = await fetch(`/api/availability/all?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.renderSlotsList(result.data.availabilities);
            } else {
                this.showMessage(result.message || 'Failed to load available slots', 'error');
            }
        } catch (error) {
            console.error('Load available slots error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    renderSlotsList(slots) {
        const container = document.getElementById('slotsList');
        if (!container) return;

        if (slots.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No available slots found</h3>
                    <p>Try adjusting your filters or check back later.</p>
                </div>
            `;
            return;
        }

        const html = slots.map(slot => this.createSlotItem(slot)).join('');
        container.innerHTML = html;
    }

    createSlotItem(slot) {
        return `
            <div class="slot-item">
                <div class="slot-main-info">
                    <div class="slot-tutor">${slot.tutorName}</div>
                    <div class="slot-datetime">
                        ${slot.formattedDate} at ${slot.timeRange}
                    </div>
                    ${slot.notes ? `<div class="slot-notes">${slot.notes}</div>` : ''}
                </div>
                <div class="slot-actions">
                    <button onclick="salesDashboard.bookSlot('${slot._id}')" class="btn btn-book btn-sm" ${!slot.isBookable ? 'disabled' : ''}>
                        ${slot.isBookable ? 'Book Now' : 'Not Available'}
                    </button>
                </div>
            </div>
        `;
    }

    async bookSlot(slotId) {
        const clientName = prompt('Enter client name:');
        if (!clientName) return;

        const clientEmail = prompt('Enter client email:');
        if (!clientEmail) return;

        const clientPhone = prompt('Enter client phone:');
        if (!clientPhone) return;

        const clientNotes = prompt('Enter client notes (optional):');

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    availabilityId: slotId,
                    clientName,
                    clientEmail,
                    clientPhone,
                    clientNotes
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('✅ Booking created successfully!', 'success');
                setTimeout(() => {
                    this.loadAvailableSlots();
                    this.loadStats();
                }, 1000);
            } else {
                this.showMessage(result.message || 'Booking failed', 'error');
            }
        } catch (error) {
            console.error('Book slot error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;

        const { current, total, hasNext, hasPrev } = pagination;
        
        let html = '';
        
        // Previous button
        html += `<button onclick="salesDashboard.goToPage(${current - 1})" ${!hasPrev ? 'disabled' : ''}>Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= total; i++) {
            if (i === current || i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                html += `<button onclick="salesDashboard.goToPage(${i})" class="${i === current ? 'active' : ''}">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += '<span>...</span>';
            }
        }
        
        // Next button
        html += `<button onclick="salesDashboard.goToPage(${current + 1})" ${!hasNext ? 'disabled' : ''}>Next</button>`;
        
        // Info
        html += `<span class="pagination-info">Page ${current} of ${total}</span>`;
        
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadAvailableSlots();
    }

    async viewTutor(tutorId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/tutors/${tutorId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showTutorModal(result.data);
            } else {
                this.showMessage(result.message || 'Failed to load tutor details', 'error');
            }
        } catch (error) {
            console.error('View tutor error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    showTutorModal(data) {
        const modal = document.getElementById('tutorModal');
        const container = document.getElementById('tutorDetails');
        
        const stats = data.stats.reduce((acc, stat) => {
            acc[stat._id] = stat;
            return acc;
        }, {});

        const html = `
            <div class="tutor-header">
                <div class="tutor-avatar">${data.tutor.name.charAt(0).toUpperCase()}</div>
                <div class="tutor-info">
                    <h3>${data.tutor.name}</h3>
                    <p>${data.tutor.email}</p>
                </div>
            </div>
            
            <div class="tutor-stats-mini">
                <div class="tutor-stat-mini">
                    <div class="tutor-stat-mini-value">${stats.available?.count || 0}</div>
                    <div class="tutor-stat-mini-label">Available</div>
                </div>
                <div class="tutor-stat-mini">
                    <div class="tutor-stat-mini-value">${stats.booked?.count || 0}</div>
                    <div class="tutor-stat-mini-label">Booked</div>
                </div>
                <div class="tutor-stat-mini">
                    <div class="tutor-stat-mini-value">${stats.available?.totalHours || 0}h</div>
                    <div class="tutor-stat-mini-label">Total Hours</div>
                </div>
            </div>
            
            <div>
                <h4>Upcoming Available Slots</h4>
                <div class="upcoming-slots-list">
                    ${data.upcomingSlots.length > 0 ? data.upcomingSlots.map(slot => `
                        <div class="upcoming-slot-item">
                            <span>${slot.formattedDate} - ${slot.timeRange}</span>
                            <button onclick="salesDashboard.openBookingModal('${slot._id}')" class="btn btn-book btn-sm">Book</button>
                        </div>
                    `).join('') : '<p>No upcoming slots available</p>'}
                </div>
            </div>
        `;

        container.innerHTML = html;
        modal.style.display = 'flex';
    }

    closeTutorModal() {
        const modal = document.getElementById('tutorModal');
        modal.style.display = 'none';
    }

    openBookingModal(slotId) {
        const modal = document.getElementById('bookingModal');
        const slotInput = document.getElementById('bookingSlotId');
        
        slotInput.value = slotId;
        modal.style.display = 'flex';
        
        // Load slot info for display
        this.loadSlotInfo(slotId);
    }

    async loadSlotInfo(slotId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/slots`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const slot = result.data.slots.find(s => s._id === slotId);
                if (slot) {
                    const container = document.getElementById('bookingSlotInfo');
                    container.innerHTML = `
                        <p><strong>Tutor:</strong> ${slot.tutor.name}</p>
                        <p><strong>Date:</strong> ${slot.formattedDate}</p>
                        <p><strong>Time:</strong> ${slot.timeRange}</p>
                        <p><strong>Duration:</strong> ${slot.duration} minutes</p>
                    `;
                }
            }
        } catch (error) {
            console.error('Load slot info error:', error);
        }
    }

    closeBookingModal() {
        const modal = document.getElementById('bookingModal');
        modal.style.display = 'none';
        document.getElementById('bookingForm').reset();
    }

    async handleBooking(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        if (!this.validateBookingForm(data)) {
            return;
        }

        const button = e.target.querySelector('button[type="submit"]');
        this.setLoadingState(button, true, 'Booking...');

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Session booked successfully!', 'success');
                this.closeBookingModal();
                await this.loadAvailableSlots();
                await this.loadStats();
            } else {
                this.showMessage(result.message || 'Failed to book session', 'error');
            }
        } catch (error) {
            console.error('Booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoadingState(button, false, 'Book Session');
        }
    }

    validateBookingForm(data) {
        if (!data.clientName || !data.clientPhone) {
            this.showMessage('Client name and phone number are required', 'error');
            return false;
        }

        if (data.clientPhone.length < 10) {
            this.showMessage('Please enter a valid phone number', 'error');
            return false;
        }

        return true;
    }

    switchView(view) {
        // Hide all views
        document.getElementById('listView').style.display = 'none';
        document.getElementById('calendarView').style.display = 'none';
        document.getElementById('statsView').style.display = 'none';

        // Show selected view
        document.getElementById(`${view}View`).style.display = 'block';

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        this.currentView = view;

        // Load view-specific data
        if (view === 'calendar') {
            this.loadCalendar();
        } else if (view === 'stats') {
            this.loadStats();
        }
    }

    async loadCalendar() {
        try {
            const token = localStorage.getItem('accessToken');
            const monthInput = document.getElementById('calendarMonth');
            const tutorSelect = document.getElementById('calendarTutor');
            
            const queryParams = new URLSearchParams({
                year: new Date(monthInput.value).getFullYear(),
                month: new Date(monthInput.value).getMonth(),
                ...(tutorSelect.value && { tutorId: tutorSelect.value })
            }).toString;

            const response = await fetch(`${this.baseURL}/calendar?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderCalendar(result.data);
            }
        } catch (error) {
            console.error('Load calendar error:', error);
        }
    }

    renderCalendar(data) {
        const container = document.getElementById('calendarGrid');
        
        // Generate calendar days (simplified version)
        const html = Object.entries(data.calendar).map(([date, dayData]) => `
            <div class="calendar-day ${dayData.slots.length > 0 ? 'has-slots' : ''}">
                <div class="calendar-day-header">${new Date(date).getDate()}</div>
                <div class="calendar-day-slots">
                    ${dayData.slots.length} slots
                    <div class="calendar-day-slot-count">${dayData.tutorCount} tutors</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html || '<div class="loading">No calendar data available</div>';
    }

    applyFilters() {
        const filters = {
            startDate: document.getElementById('filterStartDate').value,
            endDate: document.getElementById('filterEndDate').value,
            tutorId: document.getElementById('filterTutor').value,
            minDuration: document.getElementById('filterMinDuration').value,
            maxDuration: document.getElementById('filterMaxDuration').value
        };

        // Remove empty filters
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        this.currentFilters = filters;
        this.currentPage = 1;
        this.loadAvailableSlots();
    }

    clearFilters() {
        this.currentFilters = {};
        this.currentPage = 1;
        
        // Reset form
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterTutor').value = '';
        document.getElementById('filterMinDuration').value = '';
        document.getElementById('filterMaxDuration').value = '';
        
        this.setDefaultDates();
        this.loadAvailableSlots();
    }

    exportData() {
        // Simple CSV export (placeholder)
        this.showMessage('Export functionality coming soon!', 'info');
    }

    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    setLoadingState(button, isLoading, text) {
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (isLoading) {
            button.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-block';
            if (btnLoader) btnLoader.textContent = text;
        } else {
            button.disabled = false;
            if (btnText) btnText.style.display = 'inline-block';
            if (btnLoader) btnLoader.style.display = 'none';
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

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Logout function
window.logout = function() {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    window.location.href = 'index.html';
};

// Initialize dashboard
const salesDashboard = new SalesDashboard();
