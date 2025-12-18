const { contextBridge, ipcRenderer } = require('electron');

// Expose API to renderer process
contextBridge.exposeInMainWorld('api', {
  // ==================== BOOKING FUNCTIONS ====================
  getBookings: async () => {
    try {
      console.log('🔄 Fetching bookings from main process...');
      const bookings = await ipcRenderer.invoke('get-bookings');
      console.log(`✅ Received ${bookings.length} bookings from main process`);
      
      if (bookings && Array.isArray(bookings)) {
        return { success: true, data: bookings };
      } else {
        console.error('❌ Invalid bookings data received:', bookings);
        return { success: false, error: 'Invalid data received', data: [] };
      }
    } catch (error) {
      console.error('❌ Get bookings error:', error);
      console.error('❌ Error details:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  },

  updateBookingStatus: async (id, status, cancellationReason = null) => {
    try {
      console.log(`🔄 Updating booking status: ${id} to ${status}`);
      const result = await ipcRenderer.invoke('update-booking-status', id, status, cancellationReason);
      console.log('✅ Update booking status result:', result);
      return result;
    } catch (error) {
      console.error('❌ Update booking status error:', error);
      return { success: false, error: error.message };
    }
  },

  markPaymentAsPaid: async (id) => {
    try {
      console.log(`💰 Marking payment as paid for booking: ${id}`);
      const result = await ipcRenderer.invoke('mark-payment-as-paid', id);
      console.log('✅ Mark payment as paid result:', result);
      return result;
    } catch (error) {
      console.error('❌ Mark payment as paid error:', error);
      return { success: false, error: error.message };
    }
  },

  // UPDATED: New service charge function
  addServiceCharge: async (id, description, amount, newServiceCharge, newTotal) => {
    try {
      console.log(`💳 Adding service charge to booking ${id}: ${description} - ₱${amount}`);
      const result = await ipcRenderer.invoke('add-service-charge', id, description, amount, newServiceCharge, newTotal);
      console.log('✅ Add service charge result:', result);
      return result;
    } catch (error) {
      console.error('❌ Add service charge error:', error);
      return { success: false, error: error.message };
    }
  },

  // UPDATED: Complete booking function (feedback only, no rating)
  completeBooking: async (id, rating, feedback) => {
    try {
      console.log(`✅ Completing booking ${id} with feedback only`);
      const result = await ipcRenderer.invoke('complete-booking', id, null, feedback);
      console.log('✅ Complete booking result:', result);
      return result;
    } catch (error) {
      console.error('❌ Complete booking error:', error);
      return { success: false, error: error.message };
    }
  },

  // UPDATED: Get completed events statistics
  getCompletedStats: async () => {
    try {
      console.log('📊 Getting completed events statistics...');
      const result = await ipcRenderer.invoke('get-completed-stats');
      console.log('✅ Get completed stats result:', result);
      return result;
    } catch (error) {
      console.error('❌ Get completed stats error:', error);
      return { success: false, error: error.message };
    }
  },

  getBookingById: async (id) => {
    try {
      console.log(`🔍 Getting booking by ID: ${id}`);
      const booking = await ipcRenderer.invoke('get-booking-by-id', id);
      console.log('✅ Get booking by ID result:', booking ? 'Found' : 'Not found');
      return booking;
    } catch (error) {
      console.error('❌ Get booking by ID error:', error);
      return null;
    }
  },

  getBookingStats: async () => {
    try {
      console.log('📊 Getting booking statistics...');
      const stats = await ipcRenderer.invoke('get-booking-stats');
      console.log('✅ Get booking stats result:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Get booking stats error:', error);
      return { pending: 0, approved: 0, rejected: 0, completed: 0, total: 0 };
    }
  },

  getDashboardAnalytics: async () => {
    try {
      console.log('📈 Getting dashboard analytics...');
      const result = await ipcRenderer.invoke('get-dashboard-analytics');
      console.log('✅ Get dashboard analytics result:', result.success ? 'Success' : 'Failed');
      return result;
    } catch (error) {
      console.error('❌ Get dashboard analytics error:', error);
      return { success: false, error: error.message };
    }
  },

  setPaymentDeadline: async (bookingId) => {
    try {
      console.log(`⏰ Setting payment deadline for booking: ${bookingId}`);
      const result = await ipcRenderer.invoke('set-payment-deadline', bookingId);
      console.log('✅ Set payment deadline result:', result);
      return result;
    } catch (error) {
      console.error('❌ Set payment deadline error:', error);
      return { success: false, error: error.message };
    }
  },

  checkExpiredBookings: async () => {
    try {
      console.log('🔍 Checking for expired bookings...');
      const result = await ipcRenderer.invoke('check-expired-bookings');
      console.log('✅ Check expired bookings result:', result);
      return result;
    } catch (error) {
      console.error('❌ Check expired bookings error:', error);
      return { success: false, error: error.message };
    }
  },

  sendBookingApprovalEmail: async (bookingData) => {
    try {
      console.log(`📧 Sending booking approval email for: ${bookingData.booking_id}`);
      const result = await ipcRenderer.invoke('send-booking-approval-email', bookingData);
      console.log('✅ Send booking approval email result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send booking approval email error:', error);
      return { success: false, error: error.message };
    }
  },

  sendBookingRejectionEmail: async (bookingData) => {
    try {
      console.log(`📧 Sending rejection email for: ${bookingData.booking_id}`);
      const result = await ipcRenderer.invoke('send-booking-rejection-email', bookingData);
      console.log('✅ Send rejection email result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send rejection email error:', error);
      return { success: false, error: error.message };
    }
  },

  sendPaymentReceivedEmail: async (bookingData) => {
    try {
      console.log(`📧 Sending payment received email for: ${bookingData.booking_id}`);
      const result = await ipcRenderer.invoke('send-payment-received-email', bookingData);
      console.log('✅ Send payment received email result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send payment received email error:', error);
      return { success: false, error: error.message };
    }
  },

  sendBookingCancellationEmail: async (bookingData) => {
    try {
      console.log(`📧 Sending cancellation email for: ${bookingData.booking_id}`);
      const result = await ipcRenderer.invoke('send-booking-cancellation-email', bookingData);
      console.log('✅ Send cancellation email result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send cancellation email error:', error);
      return { success: false, error: error.message };
    }
  },

  getUsersByIds: async (userIds) => {
    try {
      console.log('👥 Getting users by IDs:', userIds);
      const result = await ipcRenderer.invoke('get-users-by-ids', userIds);
      console.log(`✅ Get users by IDs result: Found ${result.data?.length || 0} users`);
      return result;
    } catch (error) {
      console.error('❌ Get users by IDs error:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  getUserAvatars: async (userIds) => {
    try {
      console.log('🖼️ Getting user avatars for:', userIds);
      const result = await ipcRenderer.invoke('get-user-avatars', userIds);
      console.log(`✅ Get user avatars result: Found ${Object.keys(result.data || {}).length} avatars`);
      return result;
    } catch (error) {
      console.error('❌ Get user avatars error:', error);
      return { success: false, error: error.message, data: {} };
    }
  },

  // ==================== STAFF MANAGEMENT FUNCTIONS ====================
  getAllStaff: async () => {
    try {
      console.log('👥 Getting all staff members...');
      const result = await ipcRenderer.invoke('get-all-staff');
      console.log(`✅ Get all staff result: Found ${result.data?.length || 0} staff members`);
      
      if (result.success && result.data) {
        console.log('📝 Staff data sample:', result.data.slice(0, 2));
      }
      
      return result;
    } catch (error) {
      console.error('❌ Get all staff error:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  updateStaffStatus: async (staffId, status, rejectionReason = null) => {
    try {
      console.log(`🔄 Updating staff status: ${staffId} to ${status}`);
      const result = await ipcRenderer.invoke('update-staff-status', staffId, status, rejectionReason);
      console.log('✅ Update staff status result:', result);
      return result;
    } catch (error) {
      console.error('❌ Update staff status error:', error);
      return { success: false, error: error.message };
    }
  },

  deleteStaff: async (staffId) => {
    try {
      console.log(`🗑️ Deleting staff member: ${staffId}`);
      const result = await ipcRenderer.invoke('delete-staff', staffId);
      console.log('✅ Delete staff result:', result);
      return result;
    } catch (error) {
      console.error('❌ Delete staff error:', error);
      return { success: false, error: error.message };
    }
  },

  getStaffStats: async () => {
    try {
      console.log('📊 Getting staff statistics...');
      const result = await ipcRenderer.invoke('get-staff-stats');
      console.log('✅ Get staff stats result:', result);
      return result;
    } catch (error) {
      console.error('❌ Get staff stats error:', error);
      return { success: false, error: error.message, data: { pending: 0, approved: 0, rejected: 0, total: 0 } };
    }
  },

  sendStaffApprovalEmail: async (staffData) => {
    try {
      console.log(`📧 Sending staff approval email for: ${staffData.email}`);
      const result = await ipcRenderer.invoke('send-staff-approval-email', staffData);
      console.log('✅ Send staff approval email result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send staff approval email error:', error);
      return { success: false, error: error.message };
    }
  },

  sendStaffRejectionEmail: async (staffData) => {
    try {
      console.log(`📧 Sending staff rejection email for: ${staffData.email}`);
      const result = await ipcRenderer.invoke('send-staff-rejection-email', staffData);
      console.log('✅ Send staff rejection email result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send staff rejection email error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== USER MANAGEMENT FUNCTIONS ====================
  getAllUsers: async () => {
    try {
      console.log('👥 Getting all users...');
      const result = await ipcRenderer.invoke('get-all-users');
      console.log(`✅ Get all users result: Found ${result.data?.length || 0} users`);
      return result;
    } catch (error) {
      console.error('❌ Get all users error:', error);
      return { success: false, error: error.message, data: [] };
    }
  },

  updateUserStatus: async (userId, status) => {
    try {
      console.log(`🔄 Updating user status: ${userId} to ${status}`);
      const result = await ipcRenderer.invoke('update-user-status', userId, status);
      console.log('✅ Update user status result:', result);
      return result;
    } catch (error) {
      console.error('❌ Update user status error:', error);
      return { success: false, error: error.message };
    }
  },

  getUserStats: async () => {
    try {
      console.log('📊 Getting user statistics...');
      const result = await ipcRenderer.invoke('get-user-stats');
      console.log('✅ Get user stats result:', result);
      return result;
    } catch (error) {
      console.error('❌ Get user stats error:', error);
      return { success: false, error: error.message, data: { active: 0, total: 0 } };
    }
  },

  getUserBookingCount: async (userId) => {
    try {
      console.log(`📊 Getting booking count for user: ${userId}`);
      const result = await ipcRenderer.invoke('get-user-booking-count', userId);
      console.log(`✅ Get user booking count result: ${result.count} bookings`);
      return result;
    } catch (error) {
      console.error('❌ Get user booking count error:', error);
      return { success: false, error: error.message, count: 0 };
    }
  },

  // ==================== AUTHENTICATION FUNCTIONS ====================
  checkUserStatus: async (userId) => {
    try {
      console.log(`🔍 Checking user status: ${userId}`);
      const result = await ipcRenderer.invoke('check-user-status', userId);
      console.log('✅ Check user status result:', result);
      return result;
    } catch (error) {
      console.error('❌ Check user status error:', error);
      return { success: false, error: error.message };
    }
  },

  getUserByEmail: async (email) => {
    try {
      console.log(`🔍 Getting user by email: ${email}`);
      const result = await ipcRenderer.invoke('get-user-by-email', email);
      console.log('✅ Get user by email result:', result.success ? 'Found' : 'Not found');
      return result;
    } catch (error) {
      console.error('❌ Get user by email error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== DATABASE TESTING ====================
  testDBConnection: async () => {
    try {
      console.log('🧪 Testing database connection...');
      const result = await ipcRenderer.invoke('test-db-connection');
      console.log('✅ Test DB connection result:', result);
      return result;
    } catch (error) {
      console.error('❌ Test DB connection error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== EXPORT AND BACKUP FUNCTIONS ====================
  exportBookingsToCSV: async (filters = {}) => {
    try {
      console.log('📤 Exporting bookings to CSV...');
      const result = await ipcRenderer.invoke('export-bookings-to-csv', filters);
      console.log('✅ Export bookings to CSV result:', result);
      return result;
    } catch (error) {
      console.error('❌ Export bookings to CSV error:', error);
      return { success: false, error: error.message };
    }
  },

  exportUsersToCSV: async () => {
    try {
      console.log('📤 Exporting users to CSV...');
      const result = await ipcRenderer.invoke('export-users-to-csv');
      console.log('✅ Export users to CSV result:', result);
      return result;
    } catch (error) {
      console.error('❌ Export users to CSV error:', error);
      return { success: false, error: error.message };
    }
  },

  exportStaffToCSV: async () => {
    try {
      console.log('📤 Exporting staff to CSV...');
      const result = await ipcRenderer.invoke('export-staff-to-csv');
      console.log('✅ Export staff to CSV result:', result);
      return result;
    } catch (error) {
      console.error('❌ Export staff to CSV error:', error);
      return { success: false, error: error.message };
    }
  },

  backupDatabase: async () => {
    try {
      console.log('💾 Creating database backup...');
      const result = await ipcRenderer.invoke('backup-database');
      console.log('✅ Backup database result:', result);
      return result;
    } catch (error) {
      console.error('❌ Backup database error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== NOTIFICATION FUNCTIONS ====================
  sendNotification: async (title, body, type = 'info') => {
    try {
      console.log(`🔔 Sending notification: ${title}`);
      const result = await ipcRenderer.invoke('send-notification', title, body, type);
      console.log('✅ Send notification result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send notification error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== SETTINGS FUNCTIONS ====================
  getSettings: async () => {
    try {
      console.log('⚙️ Getting application settings...');
      const result = await ipcRenderer.invoke('get-settings');
      console.log('✅ Get settings result:', result);
      return result;
    } catch (error) {
      console.error('❌ Get settings error:', error);
      return { success: false, error: error.message, data: {} };
    }
  },

  updateSettings: async (settings) => {
    try {
      console.log('⚙️ Updating application settings...');
      const result = await ipcRenderer.invoke('update-settings', settings);
      console.log('✅ Update settings result:', result);
      return result;
    } catch (error) {
      console.error('❌ Update settings error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== LOGOUT FUNCTION ====================
  quitApp: async () => {
    try {
      console.log('👋 Quitting application...');
      const result = await ipcRenderer.invoke('quit-app');
      console.log('✅ Quit app result:', result);
      return result;
    } catch (error) {
      console.error('❌ Quit app error:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== SERVER COMMUNICATION ====================
  sendOTP: async (email) => {
    try {
      console.log(`📧 Sending OTP to: ${email}`);
      const response = await fetch('http://localhost:3000/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      console.log('✅ Send OTP result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send OTP error:', error);
      return { success: false, message: 'Failed to send OTP. Please check if server is running.' };
    }
  },

  verifyOTP: async (email, otp) => {
    try {
      console.log(`🔍 Verifying OTP for: ${email}`);
      const response = await fetch('http://localhost:3000/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp })
      });
      const result = await response.json();
      console.log('✅ Verify OTP result:', result);
      return result;
    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      return { success: false, message: 'Failed to verify OTP. Please check if server is running.' };
    }
  },

  sendBookingApprovalToServer: async (bookingData) => {
    try {
      console.log(`📧 Sending booking approval to server for: ${bookingData.booking_id}`);
      const response = await fetch('http://localhost:3000/api/send-booking-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingData })
      });
      const result = await response.json();
      console.log('✅ Send booking approval to server result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send booking approval to server error:', error);
      return { success: false, message: 'Failed to send booking approval email via server.' };
    }
  },

  sendBookingCancellationToServer: async (bookingData) => {
    try {
      console.log(`📧 Sending booking cancellation to server for: ${bookingData.booking_id}`);
      const response = await fetch('http://localhost:3000/api/send-booking-cancellation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingData })
      });
      const result = await response.json();
      console.log('✅ Send booking cancellation to server result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send booking cancellation to server error:', error);
      return { success: false, message: 'Failed to send cancellation email via server.' };
    }
  },

  sendExtraChargesNotification: async (bookingData, extraCharges) => {
    try {
      console.log(`📧 Sending extra charges notification for: ${bookingData.booking_id}`);
      const response = await fetch('http://localhost:3000/api/send-extra-charges-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingData, extraCharges })
      });
      const result = await response.json();
      console.log('✅ Send extra charges notification result:', result);
      return result;
    } catch (error) {
      console.error('❌ Send extra charges notification error:', error);
      return { success: false, message: 'Failed to send extra charges notification via server.' };
    }
  },

  checkServerHealth: async () => {
    try {
      console.log('🏥 Checking server health...');
      const response = await fetch('http://localhost:3000/api/health');
      const result = await response.json();
      console.log('✅ Server health check result:', result);
      return result;
    } catch (error) {
      console.error('❌ Server health check error:', error);
      return { status: 'error', message: 'Server is not running' };
    }
  }
});

// Platform info
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  node: process.versions.node,
  chrome: process.versions.chrome
});

// Utility functions
contextBridge.exposeInMainWorld('utils', {
  formatCurrency: (amount) => {
    return '₱' + parseFloat(amount || 0).toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  },
  
  formatTime: (time) => {
    if (!time) return 'N/A';
    
    if (typeof time === 'string' && time.includes(':')) {
      const [hours, minutes] = time.split(':');
      let hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour}:${minutes} ${ampm}`;
    }
    
    return time;
  },
  
  formatDate: (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  },
  
  formatDateTime: (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true 
    });
  },
  
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  validateEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  generateId: (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // New utility functions for service charges
  validateLocation: (location) => {
    if (!location || location.trim().length === 0) return false;
    if (location.length < 5) return false;
    return true;
  },

  calculateNewTotal: (basePrice, serviceCharge) => {
    return parseFloat(basePrice || 0) + parseFloat(serviceCharge || 0);
  },

  truncateText: (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  getLocationDisplay: (location) => {
    if (!location) return 'N/A';
    return location.length > 30 ? location.substring(0, 30) + '...' : location;
  },

  // UPDATED: Star rating utility (for display only)
  generateStarRating: (rating, maxStars = 5) => {
    let stars = '';
    for (let i = 1; i <= maxStars; i++) {
      if (i <= rating) {
        stars += '<i class="fas fa-star text-yellow-400"></i>';
      } else {
        stars += '<i class="fas fa-star text-gray-300"></i>';
      }
    }
    return stars;
  },

  // NEW: Export utilities
  downloadFile: (content, filename, contentType = 'text/csv') => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // NEW: Staff utilities
  formatStaffRole: (role) => {
    const roles = {
      'admin': 'Administrator',
      'staff': 'Staff Member',
      'manager': 'Manager',
      'supervisor': 'Supervisor'
    };
    return roles[role] || role || 'Staff Member';
  },

  formatStaffStatus: (status) => {
    const statusMap = {
      'pending': { text: 'Pending Approval', color: 'yellow' },
      'approved': { text: 'Approved', color: 'green' },
      'rejected': { text: 'Rejected', color: 'red' },
      'suspended': { text: 'Suspended', color: 'orange' }
    };
    return statusMap[status] || { text: status, color: 'gray' };
  },

  getStaffInitials: (fullName) => {
    if (!fullName) return '?';
    const names = fullName.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }
});

// Debug and logging utilities
contextBridge.exposeInMainWorld('debug', {
  log: (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.log(`[${timestamp}] ${message}`, data);
    } else {
      console.log(`[${timestamp}] ${message}`);
    }
  },
  
  error: (message, error = null) => {
    const timestamp = new Date().toLocaleTimeString();
    if (error) {
      console.error(`[${timestamp}] ❌ ${message}`, error);
    } else {
      console.error(`[${timestamp}] ❌ ${message}`);
    }
  },
  
  warn: (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.warn(`[${timestamp}] ⚠️ ${message}`, data);
    } else {
      console.warn(`[${timestamp}] ⚠️ ${message}`);
    }
  },
  
  info: (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
      console.info(`[${timestamp}] ℹ️ ${message}`, data);
    } else {
      console.info(`[${timestamp}] ℹ️ ${message}`);
    }
  },
  
  table: (data, columns = null) => {
    console.table(data, columns);
  },

  // New debug functions for service charges
  logServiceCharge: (chargeData) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 💰 Service Charge Data:`, chargeData);
  },

  logBookingUpdate: (bookingId, updates) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 📝 Booking ${bookingId} Updates:`, updates);
  },

  // UPDATED: Debug for completed events
  logCompletedEvent: (eventData) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ✅ Completed Event:`, eventData);
  },

  // NEW: Debug for staff management
  logStaffAction: (action, staffData) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 👥 Staff ${action}:`, staffData);
  }
});

// Package names mapping
contextBridge.exposeInMainWorld('constants', {
  packageNames: {
    'silver': 'Silver Package (Birthday)',
    'gold': 'Gold Package (Birthday)',
    'platinum': 'Platinum Package (Birthday)',
    'diamond': 'Diamond Package (Birthday)',
    'basic_wedding': 'Basic Wedding Package',
    'premium_wedding': 'Premium Wedding Package',
    'silver_debut': 'Silver Debut Package',
    'gold_debut': 'Gold Debut Package',
    'platinum_debut': 'Platinum Debut Package',
    'silver_corporate': 'Silver Corporate Package',
    'gold_corporate': 'Gold Corporate Package',
    'platinum_corporate': 'Platinum Corporate Package'
  },
  
  bookingStatus: {
    'pending': { color: 'yellow', text: 'Pending', icon: 'fa-clock' },
    'approved': { color: 'green', text: 'Approved', icon: 'fa-check-circle' },
    'rejected': { color: 'red', text: 'Rejected', icon: 'fa-times-circle' },
    'completed': { color: 'blue', text: 'Completed', icon: 'fa-check-double' },
    'cancelled': { color: 'gray', text: 'Cancelled', icon: 'fa-ban' }
  },
  
  paymentStatus: {
    'paid': { color: 'green', text: 'Paid', icon: 'fa-money-bill-wave' },
    'unpaid': { color: 'yellow', text: 'Unpaid', icon: 'fa-exclamation-triangle' }
  },
  
  userStatus: {
    'active': { color: 'green', text: 'Active', icon: 'fa-user-check' },
    'no-events': { color: 'gray', text: 'No Events', icon: 'fa-user' }
  },

  // NEW: Staff status constants
  staffStatus: {
    'pending': { color: 'yellow', text: 'Pending Approval', icon: 'fa-clock' },
    'approved': { color: 'green', text: 'Approved', icon: 'fa-check-circle' },
    'rejected': { color: 'red', text: 'Rejected', icon: 'fa-times-circle' },
    'suspended': { color: 'orange', text: 'Suspended', icon: 'fa-pause-circle' }
  },

  staffRoles: {
    'admin': { color: 'purple', text: 'Administrator', icon: 'fa-crown' },
    'staff': { color: 'blue', text: 'Staff Member', icon: 'fa-user' },
    'manager': { color: 'green', text: 'Manager', icon: 'fa-user-tie' },
    'supervisor': { color: 'teal', text: 'Supervisor', icon: 'fa-user-shield' }
  },

  // New constants for service charges
  serviceChargeTypes: {
    'delivery': { text: 'Delivery Fee', icon: 'fa-truck' },
    'setup': { text: 'Setup Fee', icon: 'fa-tools' },
    'overtime': { text: 'Overtime Charge', icon: 'fa-clock' },
    'location': { text: 'Location Surcharge', icon: 'fa-map-marker-alt' },
    'equipment': { text: 'Equipment Rental', icon: 'fa-microphone' },
    'staff': { text: 'Additional Staff', icon: 'fa-users' },
    'other': { text: 'Other Charges', icon: 'fa-receipt' }
  },

  // Default charge amounts for common types
  defaultCharges: {
    'delivery': 500,
    'setup': 1000,
    'overtime': 2000,
    'location': 1500,
    'equipment': 3000,
    'staff': 2500
  },

  // NEW: Export file types
  exportTypes: {
    'csv': { text: 'CSV File', icon: 'fa-file-csv', extension: 'csv' },
    'excel': { text: 'Excel File', icon: 'fa-file-excel', extension: 'xlsx' },
    'pdf': { text: 'PDF File', icon: 'fa-file-pdf', extension: 'pdf' }
  }
});

// Database schema information - UPDATED WITH NEW COLUMNS
contextBridge.exposeInMainWorld('database', {
  schema: {
    bookings: {
      id: 'UUID',
      user_id: 'UUID',
      full_name: 'TEXT',
      contact_number: 'TEXT',
      event_type: 'TEXT',
      event_date: 'DATE',
      start_time: 'TIME',
      end_time: 'TIME',
      guest_count: 'INTEGER',
      food_package: 'TEXT',
      selected_menus: 'JSONB',
      event_theme: 'TEXT',
      custom_theme: 'TEXT',
      theme_suggestions: 'TEXT',
      celebrant_name: 'TEXT',
      celebrant_age: 'INTEGER',
      location: 'TEXT',
      package_price: 'DECIMAL',
      service_charge: 'DECIMAL', // NEW COLUMN
      charge_description: 'TEXT', // NEW COLUMN
      total_price: 'DECIMAL', // NEW COLUMN
      booking_status: 'TEXT',
      payment_status: 'TEXT',
      cancellation_reason: 'TEXT', // UPDATED COLUMN
      approval_date: 'TIMESTAMP', // UPDATED COLUMN
      event_rating: 'INTEGER', // NEW COLUMN FOR COMPLETED EVENTS
      event_feedback: 'TEXT', // NEW COLUMN FOR COMPLETED EVENTS
      completion_date: 'TIMESTAMP', // NEW COLUMN FOR COMPLETED EVENTS
      payment_deadline: 'TIMESTAMP',
      created_at: 'TIMESTAMP',
      updated_at: 'TIMESTAMP'
    },
    users: {
      id: 'UUID',
      name: 'TEXT',
      email: 'TEXT',
      avatar_url: 'TEXT',
      status: 'TEXT',
      created_at: 'TIMESTAMP',
      updated_at: 'TIMESTAMP'
    },
    staff: {
      id: 'UUID',
      email: 'TEXT',
      full_name: 'TEXT',
      role: 'TEXT',
      status: 'TEXT',
      rejection_reason: 'TEXT',
      created_at: 'TIMESTAMP',
      updated_at: 'TIMESTAMP'
    }
  },

  // Helper functions for database operations
  validateBookingData: (bookingData) => {
    const required = ['full_name', 'contact_number', 'event_type', 'event_date', 'location'];
    const missing = required.filter(field => !bookingData[field]);
    return {
      valid: missing.length === 0,
      missing: missing
    };
  },

  validateServiceCharge: (chargeData) => {
    if (!chargeData.description || chargeData.description.trim().length === 0) {
      return { valid: false, error: 'Charge description is required' };
    }
    if (!chargeData.amount || parseFloat(chargeData.amount) <= 0) {
      return { valid: false, error: 'Valid charge amount is required' };
    }
    return { valid: true };
  },

  // NEW: Validate staff data
  validateStaffData: (staffData) => {
    const required = ['email', 'full_name'];
    const missing = required.filter(field => !staffData[field]);
    return {
      valid: missing.length === 0,
      missing: missing
    };
  },

  // UPDATED: Validate completed event data (feedback only, no rating required)
  validateCompletedEvent: (eventData) => {
    return { valid: true }; // Feedback is optional, no validation needed
  }
});

console.log('✅ Preload script loaded successfully');
console.log('📦 Available APIs:');
console.log('   - api.* (Main application functions)');
console.log('   - electronAPI (Platform information)');
console.log('   - utils.* (Utility functions)');
console.log('   - debug.* (Debugging utilities)');
console.log('   - constants.* (Constants and mappings)');
console.log('   - database.* (Database schema and helpers)');
console.log('');
console.log('🆕 Updated Features:');
console.log('   ✅ Automatic Server Startup');
console.log('   ✅ Loading Window Before Login');
console.log('   ✅ Server Health Monitoring');
console.log('   ✅ Complete Staff Management Functions');
console.log('   ✅ Staff Approval/Rejection with Email Notifications');
console.log('   ✅ Staff Statistics and Data Export');
console.log('   ✅ Removed Feedback Input from Complete Event Modal');
console.log('   ✅ Added No Events counter in User Management');
console.log('   ✅ Removed Active Users from Export Statistics');
console.log('   ✅ Added Complete Logout Functionality');
console.log('   ✅ Updated User Status Display (Active/No Events only)');
console.log('');
console.log('🚀 Ready to use Zaf\'s Kitchen Admin Dashboard!');