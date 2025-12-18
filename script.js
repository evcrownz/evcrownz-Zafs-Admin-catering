// Sidebar Toggle
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleBtn');
const mainContent = document.getElementById('mainContent');

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// Page Navigation
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const pageName = item.getAttribute('data-page');
        
        // Update active nav item
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show corresponding page
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(`${pageName}-page`).classList.add('active');
        
        // Load data when switching to bookings page
        if (pageName === 'bookings') {
            loadBookings();
        } else if (pageName === 'dashboard') {
            loadDashboardStats();
        }
    });
});

// Filter Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
let currentFilter = 'all';
let allBookings = [];

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(tab => tab.classList.remove('active'));
        btn.classList.add('active');
        
        currentFilter = btn.getAttribute('data-filter');
        filterBookings(currentFilter);
    });
});

// Load Bookings
async function loadBookings() {
    const bookingsGrid = document.getElementById('bookingsGrid');
    bookingsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading bookings...</p></div>';

    try {
        const bookings = await window.api.getBookings();
        allBookings = bookings || [];
        
        if (allBookings.length === 0) {
            bookingsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No bookings found</p>
                </div>
            `;
            return;
        }

        filterBookings(currentFilter);
    } catch (error) {
        console.error('Error loading bookings:', error);
        bookingsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading bookings</p>
            </div>
        `;
    }
}

// Filter Bookings
function filterBookings(filter) {
    const bookingsGrid = document.getElementById('bookingsGrid');
    
    let filtered = allBookings;
    if (filter !== 'all') {
        filtered = allBookings.filter(b => b.booking_status === filter);
    }

    if (filtered.length === 0) {
        bookingsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No ${filter} bookings found</p>
            </div>
        `;
        return;
    }

    bookingsGrid.innerHTML = filtered.map(booking => createBookingCard(booking)).join('');
}

// Create Booking Card
function createBookingCard(booking) {
    const eventDate = new Date(booking.event_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
        <div class="booking-card">
            <div class="booking-header">
                <span class="booking-id">#${booking.id.substring(0, 8)}</span>
                <span class="status-badge ${booking.booking_status}">${booking.booking_status}</span>
            </div>
            <div class="booking-info">
                <h3>${booking.full_name}</h3>
                <div class="info-row">
                    <i class="fas fa-cake-candles"></i>
                    <span>${booking.celebrant_name || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <i class="fas fa-calendar"></i>
                    <span>${eventDate}</span>
                </div>
                <div class="info-row">
                    <i class="fas fa-clock"></i>
                    <span>${booking.start_time || 'N/A'} - ${booking.end_time || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <i class="fas fa-users"></i>
                    <span>${booking.guest_count || 0} guests</span>
                </div>
                <div class="info-row">
                    <i class="fas fa-utensils"></i>
                    <span>${booking.event_type || 'N/A'}</span>
                </div>
            </div>
            <div class="booking-actions">
                <button class="btn btn-view" onclick="viewBookingDetails('${booking.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                ${booking.booking_status === 'pending' ? `
                    <button class="btn btn-approve" onclick="approveBooking('${booking.id}')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="btn btn-reject" onclick="rejectBooking('${booking.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// View Booking Details
function viewBookingDetails(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const modal = document.getElementById('bookingModal');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');

    const eventDate = new Date(booking.event_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Parse selected menus if it's a JSON string
    let menusDisplay = 'N/A';
    if (booking.selected_menus) {
        try {
            const menus = typeof booking.selected_menus === 'string' 
                ? JSON.parse(booking.selected_menus) 
                : booking.selected_menus;
            menusDisplay = Array.isArray(menus) ? menus.join(', ') : JSON.stringify(menus);
        } catch (e) {
            menusDisplay = booking.selected_menus;
        }
    }

    modalBody.innerHTML = `
        <div class="detail-group">
            <div class="detail-label">Booking ID</div>
            <div class="detail-value">${booking.id}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Status</div>
            <div class="detail-value">
                <span class="status-badge ${booking.booking_status}">${booking.booking_status}</span>
            </div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Full Name</div>
            <div class="detail-value">${booking.full_name}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Contact Number</div>
            <div class="detail-value">${booking.contact_number || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Celebrant Name</div>
            <div class="detail-value">${booking.celebrant_name || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Celebrant Age</div>
            <div class="detail-value">${booking.celebrant_age || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Event Type</div>
            <div class="detail-value">${booking.event_type || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Event Date</div>
            <div class="detail-value">${eventDate}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Time</div>
            <div class="detail-value">${booking.start_time || 'N/A'} - ${booking.end_time || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Guest Count</div>
            <div class="detail-value">${booking.guest_count || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Location</div>
            <div class="detail-value">${booking.location || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Event Theme</div>
            <div class="detail-value">${booking.event_theme || 'N/A'}</div>
        </div>
        ${booking.custom_theme ? `
        <div class="detail-group">
            <div class="detail-label">Custom Theme</div>
            <div class="detail-value">${booking.custom_theme}</div>
        </div>
        ` : ''}
        <div class="detail-group">
            <div class="detail-label">Food Package</div>
            <div class="detail-value">${booking.food_package || 'N/A'}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Selected Menus</div>
            <div class="detail-value">${menusDisplay}</div>
        </div>
        ${booking.rejection_reason ? `
        <div class="detail-group">
            <div class="detail-label">Rejection Reason</div>
            <div class="detail-value" style="color: #e74c3c;">${booking.rejection_reason}</div>
        </div>
        ` : ''}
        <div class="detail-group">
            <div class="detail-label">Created At</div>
            <div class="detail-value">${new Date(booking.created_at).toLocaleString()}</div>
        </div>
    `;

    modalFooter.innerHTML = `
        ${booking.booking_status === 'pending' ? `
            <button class="btn btn-approve" onclick="approveBooking('${booking.id}'); closeModal();">
                <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn-reject" onclick="rejectBooking('${booking.id}'); closeModal();">
                <i class="fas fa-times"></i> Reject
            </button>
        ` : ''}
        <button class="btn btn-view" onclick="closeModal()">Close</button>
    `;

    modal.classList.add('show');
}

// Approve Booking
async function approveBooking(bookingId) {
    if (!confirm('Are you sure you want to approve this booking?')) return;

    try {
        await window.api.updateBookingStatus(bookingId, 'approved', null);
        await loadBookings();
        await loadDashboardStats();
        alert('Booking approved successfully!');
    } catch (error) {
        console.error('Error approving booking:', error);
        alert('Error approving booking. Please try again.');
    }
}

// Reject Booking
async function rejectBooking(bookingId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
        await window.api.updateBookingStatus(bookingId, 'rejected', reason);
        await loadBookings();
        await loadDashboardStats();
        alert('Booking rejected successfully!');
    } catch (error) {
        console.error('Error rejecting booking:', error);
        alert('Error rejecting booking. Please try again.');
    }
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('bookingModal');
    modal.classList.remove('show');
}

// Modal Close Events
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('bookingModal').addEventListener('click', (e) => {
    if (e.target.id === 'bookingModal') {
        closeModal();
    }
});

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        const bookings = await window.api.getBookings();
        
        const pending = bookings.filter(b => b.booking_status === 'pending').length;
        const approved = bookings.filter(b => b.booking_status === 'approved').length;
        const rejected = bookings.filter(b => b.booking_status === 'rejected').length;
        const total = bookings.length;

        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('rejectedCount').textContent = rejected;
        document.getElementById('totalCount').textContent = total;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});