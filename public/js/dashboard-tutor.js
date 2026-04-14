// Tutor Dashboard JavaScript
class TutorDashboard {
    constructor() {
        this.baseURL = '/api';
        this.currentFilters = {};
        this.init();
    }

    async init() {
        // Check access control
        this.checkAccess();
        
        this.setupEventListeners();
        await this.loadUserData();
        await this.loadAvailability();
        await this.loadSummary();
        // Auto-refresh every 30 seconds for real-time sync
        setInterval(() => {
            this.loadAvailability();
            this.loadSummary();
        }, 30000);
    }

    setupEventListeners() {
        // Add availability form
        const addForm = document.getElementById('addAvailabilityForm');
        if (addForm) {
            addForm.addEventListener('submit', this.handleAddAvailability.bind(this));
        }

        // Edit availability form
        const editForm = document.getElementById('editAvailabilityForm');
        if (editForm) {
            editForm.addEventListener('submit', this.handleEditAvailability.bind(this));
        }

        // Recurring checkbox
        const recurringCheckbox = document.getElementById('isRecurring');
        if (recurringCheckbox) {
            recurringCheckbox.addEventListener('change', this.toggleRecurringOptions.bind(this));
        }

        // Set minimum date to today
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

        if (user.role !== 'tutor') {
            alert('Access Denied: This page is only for Tutors');
            window.location.href = user.role === 'sales' ? '/dashboard-sales.html' : '/index.html';
            return;
        }
    }

    updateNavbar() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const navUserName = document.getElementById('navUserName');
        if (navUserName) {
            navUserName.textContent = `👤 ${user.name || 'Tutor'}`;
        }
    }

    setMinDates() {
        const today = new Date().toISOString().split('T')[0];
        
        // Set min date for slot date
        const slotDateInput = document.getElementById('slotDate');
        if (slotDateInput) {
            slotDateInput.min = today;
        }

        // Set min date for edit date
        const editDateInput = document.getElementById('editDate');
        if (editDateInput) {
            editDateInput.min = today;
        }

        // Set min date for recurring end date
        const recurringEndDateInput = document.getElementById('recurringEndDate');
        if (recurringEndDateInput) {
            recurringEndDateInput.min = today;
        }
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

    async loadAvailability() {
        try {
            const token = localStorage.getItem('accessToken');
            const queryParams = new URLSearchParams(this.currentFilters).toString();

            const response = await fetch(`/api/availability/my?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.renderAvailabilityList(result.data.availabilities);
            } else {
                this.showMessage(result.message || 'Failed to load availability', 'error');
            }
        } catch (error) {
            console.error('Load availability error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async loadSummary() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/availability/summary`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.renderSummary(result.data.summary, result.data.upcomingSlots);
            }
        } catch (error) {
            console.error('Load summary error:', error);
        }
    }

    renderSummary(summary, upcomingSlots) {
        // Update summary numbers
        const summaryData = {
            total: 0,
            available: 0,
            booked: 0,
            hours: 0
        };

        summary.forEach(item => {
            summaryData.total += item.count;
            if (item._id === 'available') summaryData.available = item.count;
            if (item._id === 'booked') summaryData.booked = item.count;
            summaryData.hours += item.totalHours || 0;
        });

        this.updateSummaryCard('totalSlots', summaryData.total);
        this.updateSummaryCard('availableSlots', summaryData.available);
        this.updateSummaryCard('bookedSlots', summaryData.booked);
        this.updateSummaryCard('totalHours', summaryData.hours);
    }

    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    renderAvailabilityList(availabilities) {
        const listContainer = document.getElementById('availabilityList');
        if (!listContainer) return;

        if (availabilities.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No availability found</h3>
                    <p>Add your first availability slot to get started.</p>
                </div>
            `;
            return;
        }

        const html = availabilities.map(slot => this.createAvailabilityItem(slot)).join('');
        listContainer.innerHTML = html;
    }

    createAvailabilityItem(slot) {
        const isBooked = slot.status === 'booked';
        const isLocked = slot.status === 'locked';
        const isCancelled = slot.status === 'cancelled';
        const isBookable = slot.isBookable;

        return `
            <div class="availability-item ${slot.status}">
                <div class="slot-info">
                    <div class="slot-date">${slot.formattedDate}</div>
                    <div class="slot-time">${slot.timeRange}</div>
                    <span class="slot-status ${slot.status}">${slot.status}</span>
                    ${slot.notes ? `<div class="slot-notes">${slot.notes}</div>` : ''}
                    ${slot.isRecurring ? `<div class="slot-notes">Recurring (${slot.recurringPattern})</div>` : ''}
                    ${isLocked && slot.clientInfo ? `
                        <div class="slot-client-info">
                            <strong>Booked by:</strong> ${slot.clientInfo.name}
                            <br><strong>Email:</strong> ${slot.clientInfo.email}
                            <br><strong>Phone:</strong> ${slot.clientInfo.phone}
                            ${slot.clientInfo.notes ? `<br><strong>Notes:</strong> ${slot.clientInfo.notes}` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="slot-actions">
                    ${isLocked ? `
                        <button onclick="tutorDashboard.acceptBooking('${slot._id}')" class="btn btn-success btn-sm">Accept</button>
                        <button onclick="tutorDashboard.rejectBooking('${slot._id}')" class="btn btn-danger btn-sm">Reject</button>
                    ` : ''}
                    ${!isBooked && !isLocked && !isCancelled ? `
                        <button onclick="tutorDashboard.editSlot('${slot._id}')" class="btn btn-outline btn-sm">Edit</button>
                        <button onclick="tutorDashboard.deleteSlot('${slot._id}')" class="btn btn-danger btn-sm">Delete</button>
                    ` : ''}
                    ${isBooked ? `
                        <button disabled class="btn btn-secondary btn-sm">Booked</button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    async handleAddAvailability(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Convert checkbox to boolean
        data.isRecurring = formData.has('isRecurring');

        if (!this.validateAvailabilityForm(data)) {
            return;
        }

        const button = document.getElementById('addSlotBtn');
        this.setLoadingState(button, true, 'Adding...');

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/availability`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                e.target.reset();
                this.toggleRecurringOptions();
                await this.loadAvailability();
                await this.loadSummary();
            } else {
                this.showMessage(result.message || 'Failed to add availability', 'error');
            }
        } catch (error) {
            console.error('Add availability error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoadingState(button, false, 'Add Slot');
        }
    }

    async handleEditAvailability(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const slotId = data.id;
        delete data.id;

        if (!this.validateAvailabilityForm(data)) {
            return;
        }

        const button = e.target.querySelector('button[type="submit"]');
        this.setLoadingState(button, true, 'Saving...');

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/availability/${slotId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                this.closeEditModal();
                await this.loadAvailability();
                await this.loadSummary();
            } else {
                this.showMessage(result.message || 'Failed to update availability', 'error');
            }
        } catch (error) {
            console.error('Edit availability error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setLoadingState(button, false, 'Save Changes');
        }
    }

    validateAvailabilityForm(data) {
        if (!data.date || !data.startTime || !data.endTime) {
            this.showMessage('Please fill in all required fields', 'error');
            return false;
        }

        if (data.startTime >= data.endTime) {
            this.showMessage('End time must be after start time', 'error');
            return false;
        }

        if (data.isRecurring && (!data.recurringPattern || !data.recurringEndDate)) {
            this.showMessage('Please provide recurring pattern and end date', 'error');
            return false;
        }

        return true;
    }

    async editSlot(slotId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${this.baseURL}/availability`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const slot = result.data.availabilities.find(s => s._id === slotId);
                if (slot) {
                    this.openEditModal(slot);
                } else {
                    this.showMessage('Slot not found', 'error');
                }
            }
        } catch (error) {
            console.error('Edit slot error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    openEditModal(slot) {
        const modal = document.getElementById('editModal');
        const form = document.getElementById('editAvailabilityForm');
        
        // Populate form
        document.getElementById('editSlotId').value = slot._id;
        document.getElementById('editDate').value = new Date(slot.date).toISOString().split('T')[0];
        document.getElementById('editStartTime').value = slot.startTime;
        document.getElementById('editEndTime').value = slot.endTime;
        document.getElementById('editNotes').value = slot.notes || '';
        document.getElementById('editStatus').value = slot.status;
        
        modal.style.display = 'flex';
    }

    closeEditModal() {
        const modal = document.getElementById('editModal');
        modal.style.display = 'none';
    }

    async deleteSlot(slotId) {
        if (!confirm('Are you sure you want to delete this availability slot?')) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/availability/${slotId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                await this.loadAvailability();
                await this.loadSummary();
            } else {
                this.showMessage(result.message || 'Failed to delete availability', 'error');
            }
        } catch (error) {
            console.error('Delete slot error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async acceptBooking(slotId) {
        if (!confirm('Accept this booking?')) {
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/availability/${slotId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                await this.loadAvailability();
                await this.loadSummary();
            } else {
                this.showMessage(result.message || 'Failed to accept booking', 'error');
            }
        } catch (error) {
            console.error('Accept booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async rejectBooking(slotId) {
        const reason = prompt('Reason for rejection:');
        if (!reason) return;

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/availability/${slotId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ reason })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                await this.loadAvailability();
                await this.loadSummary();
            } else {
                this.showMessage(result.message || 'Failed to reject booking', 'error');
            }
        } catch (error) {
            console.error('Reject booking error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    toggleRecurringOptions() {
        const checkbox = document.getElementById('isRecurring');
        const options = document.getElementById('recurringOptions');
        
        if (options) {
            options.style.display = checkbox.checked ? 'block' : 'none';
        }
    }

    applyFilters() {
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const status = document.getElementById('filterStatus').value;

        this.currentFilters = {};
        if (startDate) this.currentFilters.startDate = startDate;
        if (endDate) this.currentFilters.endDate = endDate;
        if (status) this.currentFilters.status = status;

        this.loadAvailability();
    }

    clearFilters() {
        this.currentFilters = {};
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterStatus').value = '';
        
        this.loadAvailability();
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

// Global functions for onclick handlers
window.applyFilters = () => tutorDashboard.applyFilters();
window.clearFilters = () => tutorDashboard.clearFilters();
window.closeEditModal = () => tutorDashboard.closeEditModal();

// Logout function
window.logout = function() {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    window.location.href = 'index.html';
};

// Initialize dashboard
const tutorDashboard = new TutorDashboard();
