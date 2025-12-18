require('dotenv').config();

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const db = require('./db');
const axios = require('axios');
const { spawn } = require('child_process');

// Check if running in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Server process variable
let serverProcess = null;
let mainWindow = null;
let serverStartAttempts = 0;
const MAX_SERVER_ATTEMPTS = 5;

// Function to check if server is running
async function checkServerHealth() {
  try {
    const response = await axios.get('http://localhost:3000/api/health', {
      timeout: 3000
    });
    return response.data.status === 'ok';
  } catch (error) {
    console.log('❌ Server not running or not responding...');
    return false;
  }
}

// Function to start backend server with retries
async function startBackendServer() {
  console.log('🔄 Attempting to start backend server...');
  
  if (serverProcess) {
    console.log('🔴 Killing existing server process...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const serverPath = path.join(__dirname, 'server.js');
  
  console.log(`📂 Server path: ${serverPath}`);
  
  serverProcess = spawn('node', [serverPath], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    detached: false,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  serverProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`[SERVER]: ${message}`);
    
    // If mainWindow exists, send log to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-log', message);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    console.error(`[SERVER ERROR]: ${error}`);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-error', error);
    }
  });

  serverProcess.on('close', (code) => {
    console.log(`[SERVER] Process exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    console.error('[SERVER] Failed to start:', err);
    serverProcess = null;
  });

  // Wait a bit for server to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return serverProcess;
}

// Wait for server to be ready with retry logic
async function waitForServer(maxAttempts = 15, interval = 2000) {
  console.log('⏳ Waiting for server to start...');
  
  serverStartAttempts = 0;
  
  while (serverStartAttempts < maxAttempts) {
    serverStartAttempts++;
    console.log(`Checking server (Attempt ${serverStartAttempts}/${maxAttempts})...`);
    
    try {
      const isHealthy = await checkServerHealth();
      
      if (isHealthy) {
        console.log('✅ Server is now running and healthy!');
        return true;
      }
      
      // If this is the first attempt and server is not running, try to start it
      if (serverStartAttempts === 1) {
        console.log('🚀 Starting server process...');
        await startBackendServer();
      }
      
      if (serverStartAttempts < maxAttempts) {
        console.log(`Waiting ${interval/1000} seconds before next check...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (err) {
      console.log(`Attempt ${serverStartAttempts} failed: ${err.message}`);
      if (serverStartAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
  
  console.log('❌ Server failed to start within expected time');
  return false;
}

// Create loading window
function createLoadingWindow() {
  console.log('🔄 Creating loading window...');
  
  const loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  loadingWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'));
  
  return loadingWindow;
}

// Create main window function
async function createWindow() {
  console.log('🚀 Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    center: true,
    icon: path.join(__dirname, 'logo-desktop', 'logo.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    frame: true,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      enableRemoteModule: false,
      spellcheck: false,
      disableBlinkFeatures: 'Auxclick',
      devTools: isDevelopment,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDevelopment) {
      const blockedShortcuts = [
        'F12',
        'F11',
        'Ctrl+Shift+I',
        'Ctrl+Shift+J',
        'Ctrl+Shift+C',
        'Ctrl+U',
        'Ctrl+P',
        'Ctrl+S',
        'Ctrl+R'
      ];
      
      const shortcut = [];
      if (input.control) shortcut.push('Ctrl');
      if (input.shift) shortcut.push('Shift');
      if (input.alt) shortcut.push('Alt');
      if (input.key && input.key !== 'Control' && input.key !== 'Shift' && input.key !== 'Alt') {
        shortcut.push(input.key.toUpperCase());
      }
      
      const shortcutString = shortcut.join('+');
      
      if (blockedShortcuts.includes(input.key) || 
          blockedShortcuts.includes(shortcutString)) {
        event.preventDefault();
      }
    }
  });

  // Wait for server before loading page
  const loadingWindow = createLoadingWindow();
  
  try {
    // Try to check if server is already running
    let serverReady = await checkServerHealth();
    
    if (!serverReady) {
      console.log('📡 Backend server is not running, starting it now...');
      
      // Show loading window
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.show();
      }
      
      serverReady = await waitForServer(12, 3000);
    }
    
    // Close loading window
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    
    if (!serverReady) {
      console.error('❌ Cannot proceed without backend server');
      
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        buttons: ['Retry', 'Exit'],
        defaultId: 0,
        cancelId: 1,
        title: 'Server Error',
        message: 'Backend server failed to start.',
        detail: 'The backend server could not be started on port 3000. Please ensure the port is available and try again.'
      });
      
      if (choice === 0) {
        // Retry
        await createWindow();
        return;
      } else {
        app.quit();
        return;
      }
    } else {
      console.log('✅ Backend server is ready');
    }
    
    // Load OTP/Login page
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
    
  } catch (err) {
    console.error('Error during startup:', err);
    
    // Close loading window
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    
    dialog.showErrorBox(
      'Startup Error',
      'Failed to start application. Please check if port 3000 is available.'
    );
    
    app.quit();
  }

  Menu.setApplicationMenu(null);
}

// App ready event
app.whenReady().then(async () => {
  console.log('🚀 Starting Zaf\'s Kitchen Admin Dashboard...');
  console.log(`📁 App path: ${__dirname}`);
  console.log(`🔧 Mode: ${isDevelopment ? 'Development' : 'Production'}`);
  
  await createWindow();
});

// Cleanup on quit
app.on('before-quit', () => {
  console.log('🛑 Cleaning up before quit...');
  
  if (serverProcess) {
    console.log('🔴 Stopping backend server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    console.log('Closing application...');
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for checking server status
ipcMain.handle('check-server-status', async () => {
  const isHealthy = await checkServerHealth();
  return { running: isHealthy };
});

// IPC handler for restarting server
ipcMain.handle('restart-server', async () => {
  try {
    console.log('🔄 Restarting backend server...');
    
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await startBackendServer();
    
    const serverReady = await waitForServer(8, 3000);
    
    return { success: serverReady, message: serverReady ? 'Server restarted successfully' : 'Failed to restart server' };
  } catch (err) {
    console.error('Error restarting server:', err);
    return { success: false, message: err.message };
  }
});

// IPC handler for starting server manually
ipcMain.handle('start-server-manually', async () => {
  try {
    console.log('🔄 Starting server manually...');
    
    const isHealthy = await checkServerHealth();
    if (isHealthy) {
      return { success: true, message: 'Server is already running' };
    }
    
    await startBackendServer();
    
    const serverReady = await waitForServer(10, 3000);
    
    return { 
      success: serverReady, 
      message: serverReady ? 'Server started successfully' : 'Failed to start server' 
    };
  } catch (err) {
    console.error('Error starting server:', err);
    return { success: false, message: err.message };
  }
});

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM;
const BREVO_FROM_NAME = process.env.BREVO_NAME;

// Function to send booking approval email
async function sendBookingApprovalEmail(bookingData) {
  try {
    const { email, full_name, booking_id, package_price, service_charge, charge_description, total_price, event_date } = bookingData;
    
    const brevoData = {
      sender: {
        name: BREVO_FROM_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: [
        {
          email: email,
          name: full_name
        }
      ],
      subject: 'Your Booking Has Been Approved! - Zaf\'s Kitchen',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='UTF-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <title>Booking Approved</title>
        </head>
        <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
          <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 30px;'>
              <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
              <p style='color: #666; margin: 5px 0 0 0; font-size: 14px;'>Catering Services</p>
            </div>
            
            <div style='background: linear-gradient(135deg, #d4edda, #c3e6cb); padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #28a745;'>
              <h2 style='color: #155724; margin: 0 0 15px 0; font-size: 28px;'>Booking Approved!</h2>
              <p style='color: #155724; margin: 0; font-size: 16px;'>Your booking request has been approved!</p>
            </div>
            
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
              <h3 style='color: #DC2626; margin-top: 0;'>Booking Details</h3>
              <table style='width: 100%; border-collapse: collapse;'>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Booking ID:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${booking_id}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Customer Name:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${full_name}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Event Date:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${new Date(event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ${service_charge > 0 ? `
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Base Package Price:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>₱${parseFloat(package_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Additional Service Charge:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>+ ₱${parseFloat(service_charge).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Charge Description:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${charge_description}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Total Amount:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>₱${parseFloat(total_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                </tr>
              </table>
            </div>

            <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #856404; margin-top: 0;'>Important Payment Deadline</h3>
              <p style='color: #856404; margin: 10px 0;'><strong>You have 20 hours to complete your payment.</strong></p>
              <p style='color: #856404; margin: 10px 0;'>If payment is not received within 20 hours, your booking will be automatically cancelled.</p>
            </div>

            <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #004085; margin-top: 0;'>Payment Instructions</h3>
              <p style='color: #004085; margin: 15px 0;'><strong>Payment Methods Available:</strong></p>
              
              <div style='background-color: white; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #00a859;'>
                <h4 style='color: #00a859; margin: 0 0 10px 0;'>GCash Payment</h4>
                <p style='margin: 5px 0;'><strong>GCash Number:</strong> <span style='color: #DC2626; font-size: 18px;'>0917 123 4567</span></p>
                <p style='margin: 5px 0;'><strong>Account Name:</strong> ZAF'S KITCHEN</p>
                <p style='margin: 5px 0;'><strong>Amount:</strong> ₱${parseFloat(total_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              <div style='background-color: white; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #0033a0;'>
                <h4 style='color: #0033a0; margin: 0 0 10px 0;'>Maya Payment</h4>
                <p style='margin: 5px 0;'><strong>Maya Number:</strong> <span style='color: #DC2626; font-size: 18px;'>0917 123 4567</span></p>
                <p style='margin: 5px 0;'><strong>Account Name:</strong> ZAF'S KITCHEN</p>
                <p style='margin: 5px 0;'><strong>Amount:</strong> ₱${parseFloat(total_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 15px 0;'>
                <h4 style='color: #856404; margin: 0 0 10px 0;'>Important Payment Verification</h4>
                <p style='color: #856404; margin: 8px 0;'><strong>After payment, please:</strong></p>
                <ol style='color: #856404; margin: 8px 0; padding-left: 20px;'>
                  <li>Take a clear screenshot of your payment confirmation</li>
                  <li>Save the transaction reference number</li>
                  <li>Email the screenshot and reference number to: <strong>zafskitchen95@gmail.com</strong></li>
                  <li>Include your Booking ID: <strong>${booking_id}</strong> in the email</li>
                </ol>
                <p style='color: #856404; margin: 8px 0;'><em>Your booking will only be confirmed after we verify your payment.</em></p>
              </div>
            </div>

            <div style='background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #0c5460; margin-top: 0;'>Contact Information</h3>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Facebook:</strong> <a href='https://facebook.com/zafskitchen' style='color: #DC2626;'>Zaf's Kitchen Official</a></p>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Phone:</strong> 0917 123 4567</p>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
            </div>

            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
              <p style='font-size: 14px; color: #666; margin: 0;'>Thank you for choosing Zaf's Kitchen!</p>
              <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      brevoData,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log(`Booking approval email sent to ${email}`);
      return { success: true, message: 'Email sent successfully' };
    } else {
      throw new Error(`Brevo API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Send booking approval email error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Function to send booking rejection email
async function sendBookingRejectionEmail(bookingData) {
  try {
    const { email, full_name, booking_id, rejection_reason } = bookingData;
    
    const brevoData = {
      sender: {
        name: BREVO_FROM_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: [
        {
          email: email,
          name: full_name
        }
      ],
      subject: 'Booking Request Declined - Zaf\'s Kitchen',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='UTF-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <title>Booking Declined</title>
        </head>
        <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
          <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 30px;'>
              <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
            </div>
            
            <div style='background: #f8d7da; padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #dc3545;'>
              <h2 style='color: #721c24; margin: 0 0 15px 0; font-size: 28px;'>Booking Declined</h2>
              <p style='color: #721c24; margin: 0; font-size: 16px;'>We regret to inform you that your booking request has been declined.</p>
            </div>
            
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
              <h3 style='color: #DC2626; margin-top: 0;'>Booking Details</h3>
              <p><strong>Booking ID:</strong> ${booking_id}</p>
              <p><strong>Customer Name:</strong> ${full_name}</p>
            </div>

            <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #856404; margin-top: 0;'>Reason for Declination</h3>
              <p style='color: #856404; margin: 10px 0;'><strong>${rejection_reason}</strong></p>
            </div>

            <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #004085; margin-top: 0;'>Need Assistance?</h3>
              <p style='color: #004085; margin: 10px 0;'>If you have questions or would like to discuss alternative options, please feel free to contact us.</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Contact:</strong> 0917 123 4567</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Facebook:</strong> <a href='https://facebook.com/zafskitchen' style='color: #DC2626;'>Zaf's Kitchen Official</a></p>
            </div>

            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
              <p style='font-size: 14px; color: #666; margin: 0;'>We hope to serve you in the future!</p>
              <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      brevoData,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log(`Rejection email sent to ${email}`);
      return { success: true, message: 'Rejection email sent successfully' };
    } else {
      throw new Error(`Brevo API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Send rejection email error:', error);
    return { success: false, error: error.message };
  }
}

// Function to send payment received email
async function sendPaymentReceivedEmail(bookingData) {
  try {
    const { email, full_name, booking_id, package_price, service_charge, charge_description, total_price, event_date } = bookingData;
    
    const brevoData = {
      sender: {
        name: BREVO_FROM_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: [
        {
          email: email,
          name: full_name
        }
      ],
      subject: 'Payment Received - Booking Confirmed! - Zaf\'s Kitchen',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='UTF-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <title>Payment Received</title>
        </head>
        <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
          <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 30px;'>
              <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
              <p style='color: #666; margin: 5px 0 0 0; font-size: 14px;'>Catering Services</p>
            </div>
            
            <div style='background: linear-gradient(135deg, #d4edda, #c3e6cb); padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #28a745;'>
              <h2 style='color: #155724; margin: 0 0 15px 0; font-size: 28px;'>Payment Received!</h2>
              <p style='color: #155724; margin: 0; font-size: 16px;'>Your booking is now confirmed!</p>
            </div>
            
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
              <h3 style='color: #DC2626; margin-top: 0;'>Booking Confirmation</h3>
              <table style='width: 100%; border-collapse: collapse;'>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Booking ID:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${booking_id}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Customer Name:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${full_name}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Event Date:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${new Date(event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ${service_charge > 0 ? `
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Base Package Price:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>₱${parseFloat(package_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Additional Service Charge:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>+ ₱${parseFloat(service_charge).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Charge Description:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${charge_description}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Total Amount Paid:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>₱${parseFloat(total_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                </tr>
                <tr>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Payment Status:</strong></td>
                  <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong style='color: #28a745;'>PAID</strong></td>
                </tr>
              </table>
            </div>

            <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #004085; margin-top: 0;'>What\'s Next?</h3>
              <p style='color: #004085; margin: 10px 0;'><strong>Your event is now officially booked!</strong></p>
              <p style='color: #004085; margin: 10px 0;'>We will contact you 3 days before your event date to confirm final details and discuss any last-minute requirements.</p>
            </div>

            <div style='background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #0c5460; margin-top: 0;'>Contact Information</h3>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Facebook:</strong> <a href='https://facebook.com/zafskitchen' style='color: #DC2626;'>Zaf's Kitchen Official</a></p>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Phone:</strong> 0917 123 4567</p>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
            </div>

            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
              <p style='font-size: 14px; color: #666; margin: 0;'>Thank you for choosing Zaf's Kitchen! We look forward to serving you.</p>
              <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      brevoData,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log(`Payment received email sent to ${email}`);
      return { success: true, message: 'Payment received email sent successfully' };
    } else {
      throw new Error(`Brevo API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Send payment received email error:', error);
    return { success: false, error: error.message };
  }
}

// Function to send booking cancellation email
async function sendBookingCancellationEmail(bookingData) {
  try {
    const { email, full_name, booking_id } = bookingData;
    
    const brevoData = {
      sender: {
        name: BREVO_FROM_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: [
        {
          email: email,
          name: full_name
        }
      ],
      subject: 'Booking Cancelled - Zaf\'s Kitchen',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='UTF-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <title>Booking Cancelled</title>
        </head>
        <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
          <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 30px;'>
              <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
            </div>
            
            <div style='background: #f8d7da; padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #dc3545;'>
              <h2 style='color: #721c24; margin: 0 0 15px 0; font-size: 28px;'>Booking Cancelled</h2>
              <p style='color: #721c24; margin: 0; font-size: 16px;'>Your booking has been cancelled due to non-payment.</p>
            </div>
            
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
              <h3 style='color: #DC2626; margin-top: 0;'>Booking Details</h3>
              <p><strong>Booking ID:</strong> ${booking_id}</p>
              <p><strong>Customer Name:</strong> ${full_name}</p>
              <p><strong>Reason for Cancellation:</strong> Payment was not received within the 20-hour deadline.</p>
            </div>

            <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #004085; margin-top: 0;'>Need Assistance?</h3>
              <p style='color: #004085; margin: 10px 0;'>If you still wish to proceed with your booking or encountered issues with payment, please contact us immediately.</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Contact:</strong> 0917 123 4567</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
            </div>

            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
              <p style='font-size: 14px; color: #666; margin: 0;'>We hope to serve you in the future!</p>
              <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      brevoData,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log(`Cancellation email sent to ${email}`);
      return { success: true, message: 'Cancellation email sent successfully' };
    } else {
      throw new Error(`Brevo API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Send cancellation email error:', error);
    return { success: false, error: error.message };
  }
}

// Function to send staff approval email
async function sendStaffApprovalEmail(staffData) {
  try {
    const { email, full_name } = staffData;
    
    const brevoData = {
      sender: {
        name: BREVO_FROM_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: [
        {
          email: email,
          name: full_name
        }
      ],
      subject: 'Staff Account Approved - Zaf\'s Kitchen',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='UTF-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <title>Staff Account Approved</title>
        </head>
        <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
          <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 30px;'>
              <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
              <p style='color: #666; margin: 5px 0 0 0; font-size: 14px;'>Staff Portal</p>
            </div>
            
            <div style='background: linear-gradient(135deg, #d4edda, #c3e6cb); padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #28a745;'>
              <h2 style='color: #155724; margin: 0 0 15px 0; font-size: 28px;'>Account Approved!</h2>
              <p style='color: #155724; margin: 0; font-size: 16px;'>Your staff account has been approved!</p>
            </div>
            
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
              <h3 style='color: #DC2626; margin-top: 0;'>Account Information</h3>
              <p><strong>Name:</strong> ${full_name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Role:</strong> Staff</p>
              <p><strong>Status:</strong> <span style='color: #28a745; font-weight: bold;'>Approved</span></p>
            </div>

            <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #004085; margin-top: 0;'>What\'s Next?</h3>
              <p style='color: #004085; margin: 10px 0;'><strong>You can now sign in to the Zaf's Kitchen Staff Portal using your registered email and password.</strong></p>
              <p style='color: #004085; margin: 10px 0;'>Access the staff dashboard to manage bookings, view customer information, and track catering events.</p>
            </div>

            <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #856404; margin-top: 0;'>How to Access</h3>
              <p style='color: #856404; margin: 10px 0;'>1. Open the Zaf's Kitchen Staff App</p>
              <p style='color: #856404; margin: 10px 0;'>2. Enter your email: <strong>${email}</strong></p>
              <p style='color: #856404; margin: 10px 0;'>3. Enter your password</p>
              <p style='color: #856404; margin: 10px 0;'>4. Click "Sign In" to access the dashboard</p>
            </div>

            <div style='background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #0c5460; margin-top: 0;'>Need Help?</h3>
              <p style='color: #0c5460; margin: 8px 0;'>If you encounter any issues signing in or have questions about your account, please contact the administrator.</p>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
              <p style='color: #0c5460; margin: 8px 0;'><strong>Phone:</strong> 0917 123 4567</p>
            </div>

            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
              <p style='font-size: 14px; color: #666; margin: 0;'>Welcome to the Zaf's Kitchen team!</p>
              <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      brevoData,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log(`Staff approval email sent to ${email}`);
      return { success: true, message: 'Staff approval email sent successfully' };
    } else {
      throw new Error(`Brevo API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Send staff approval email error:', error);
    return { success: false, error: error.message };
  }
}

// Function to send staff rejection email
async function sendStaffRejectionEmail(staffData) {
  try {
    const { email, full_name, rejection_reason } = staffData;
    
    const brevoData = {
      sender: {
        name: BREVO_FROM_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: [
        {
          email: email,
          name: full_name
        }
      ],
      subject: 'Staff Account Declined - Zaf\'s Kitchen',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='UTF-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <title>Staff Account Declined</title>
        </head>
        <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
          <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 30px;'>
              <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
              <p style='color: #666; margin: 5px 0 0 0; font-size: 14px;'>Staff Portal</p>
            </div>
            
            <div style='background: #f8d7da; padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #dc3545;'>
              <h2 style='color: #721c24; margin: 0 0 15px 0; font-size: 28px;'>Account Declined</h2>
              <p style='color: #721c24; margin: 0; font-size: 16px;'>We regret to inform you that your staff account application has been declined.</p>
            </div>
            
            <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
              <h3 style='color: #DC2626; margin-top: 0;'>Account Information</h3>
              <p><strong>Name:</strong> ${full_name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Status:</strong> <span style='color: #dc3545; font-weight: bold;'>Declined</span></p>
            </div>

            <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #856404; margin-top: 0;'>Reason for Declination</h3>
              <p style='color: #856404; margin: 10px 0;'><strong>${rejection_reason}</strong></p>
            </div>

            <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
              <h3 style='color: #004085; margin-top: 0;'>Need Assistance?</h3>
              <p style='color: #004085; margin: 10px 0;'>If you believe this was a mistake or would like to discuss your application further, please contact us.</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
              <p style='color: #004085; margin: 8px 0;'><strong>Phone:</strong> 0917 123 4567</p>
            </div>

            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
              <p style='font-size: 14px; color: #666; margin: 0;'>Thank you for your interest in joining Zaf's Kitchen.</p>
              <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      brevoData,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log(`Staff rejection email sent to ${email}`);
      return { success: true, message: 'Staff rejection email sent successfully' };
    } else {
      throw new Error(`Brevo API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Send staff rejection email error:', error);
    return { success: false, error: error.message };
  }
}

// --------------------------------------------------
// DATABASE HANDLERS - BOOKINGS
// --------------------------------------------------

// Get all bookings with user avatars
ipcMain.handle('get-bookings', async () => {
  try {
    console.log('Fetching all bookings with user data...');
    
    try {
      const testResult = await db.query('SELECT NOW() as current_time');
      console.log('Database connection successful:', testResult.rows[0].current_time);
    } catch (dbError) {
      console.error('Database connection failed:', dbError.message);
      return [];
    }

    let result;
    try {
      result = await db.query(`
        SELECT 
          b.id,
          b.user_id,
          b.full_name,
          b.contact_number,
          b.celebrant_name,
          b.celebrant_age,
          b.guest_count,
          b.food_package,
          b.event_type,
          b.event_date,
          b.start_time,
          b.end_time,
          b.location,
          b.event_theme,
          b.custom_theme,
          b.theme_suggestions,
          b.selected_menus,
          b.package_price,
          b.service_charge,
          b.charge_description,
          b.total_price,
          b.booking_status,
          b.payment_status,
          b.cancellation_reason,
          b.approval_date,
          b.event_rating,
          b.event_feedback,
          b.completion_date,
          b.created_at,
          b.updated_at,
          b.payment_deadline,
          u.avatar_url,
          u.email as user_email
        FROM bookings b
        LEFT JOIN usertable u ON b.user_id = u.id
        ORDER BY b.created_at DESC
      `);
    } catch (joinError) {
      console.log('LEFT JOIN failed, trying simple query...');
      result = await db.query(`
        SELECT 
          id,
          user_id,
          full_name,
          contact_number,
          celebrant_name,
          celebrant_age,
          guest_count,
          food_package,
          event_type,
          event_date,
          start_time,
          end_time,
          location,
          event_theme,
          custom_theme,
          theme_suggestions,
          selected_menus,
          package_price,
          service_charge,
          charge_description,
          total_price,
          booking_status,
          payment_status,
          cancellation_reason,
          approval_date,
          event_rating,
          event_feedback,
          completion_date,
          created_at,
          updated_at,
          payment_deadline
        FROM bookings 
        ORDER BY created_at DESC
      `);
    }
    
    console.log(`Found ${result.rows.length} bookings`);
    
    if (result.rows.length > 0) {
      console.log('First 3 bookings:');
      result.rows.slice(0, 3).forEach((booking, index) => {
        console.log(`  ${index + 1}. ${booking.full_name} - ${booking.booking_status} - ${booking.event_type}`);
      });
    } else {
      console.log('No bookings found in database');
    }
    
    return result.rows;
  } catch (err) {
    console.error('DB Error (get-bookings):', err.message);
    console.error('Error stack:', err.stack);
    return [];
  }
});

// Update booking status
ipcMain.handle('update-booking-status', async (event, bookingId, status, cancellationReason) => {
  try {
    console.log(`Updating booking ${bookingId} to status: ${status}`);
    
    let query;
    let params;

    if (status === 'rejected' && cancellationReason) {
      query = `
        UPDATE bookings 
        SET booking_status = $1, cancellation_reason = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      params = [status, cancellationReason, bookingId];
    } else if (status === 'approved') {
      query = `
        UPDATE bookings 
        SET booking_status = $1, cancellation_reason = NULL, approval_date = NOW(), updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      params = [status, bookingId];
    } else {
      query = `
        UPDATE bookings 
        SET booking_status = $1, cancellation_reason = NULL, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      params = [status, bookingId];
    }

    const result = await db.query(query, params);
    
    if (result.rows.length > 0) {
      console.log('Booking updated successfully');
      return { success: true, booking: result.rows[0] };
    } else {
      console.log('Booking not found');
      return { success: false, error: 'Booking not found' };
    }
  } catch (err) {
    console.error('DB Error (update-booking-status):', err);
    return { success: false, error: err.message };
  }
});

// Mark payment as paid
ipcMain.handle('mark-payment-as-paid', async (event, bookingId) => {
  try {
    console.log(`Marking payment as paid for booking: ${bookingId}`);
    
    const result = await db.query(`
      UPDATE bookings 
      SET payment_status = 'paid', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [bookingId]);

    if (result.rows.length > 0) {
      console.log('Payment marked as paid successfully');
      return { success: true, booking: result.rows[0] };
    } else {
      console.log('Booking not found');
      return { success: false, error: 'Booking not found' };
    }
  } catch (err) {
    console.error('DB Error (mark-payment-as-paid):', err);
    return { success: false, error: err.message };
  }
});

// Add service charge
ipcMain.handle('add-service-charge', async (event, bookingId, description, amount, newServiceCharge, newTotal) => {
  try {
    console.log(`Adding service charge to booking ${bookingId}: ${description} - ₱${amount}`);
    
    const result = await db.query(`
      UPDATE bookings 
      SET charge_description = $1, service_charge = $2, total_price = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [description, newServiceCharge, newTotal, bookingId]);

    if (result.rows.length > 0) {
      console.log('Service charge added successfully');
      return { success: true, booking: result.rows[0] };
    } else {
      console.log('Booking not found');
      return { success: false, error: 'Booking not found' };
    }
  } catch (err) {
    console.error('DB Error (add-service-charge):', err);
    return { success: false, error: err.message };
  }
});

// Complete booking with feedback only (no rating)
ipcMain.handle('complete-booking', async (event, bookingId, rating, feedback) => {
  try {
    console.log(`Completing booking ${bookingId} with feedback only`);
    
    const result = await db.query(`
      UPDATE bookings 
      SET booking_status = 'completed', 
          event_feedback = $1,
          completion_date = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [feedback, bookingId]);

    if (result.rows.length > 0) {
      console.log('Booking marked as completed successfully');
      return { success: true, booking: result.rows[0] };
    } else {
      console.log('Booking not found');
      return { success: false, error: 'Booking not found' };
    }
  } catch (err) {
    console.error('DB Error (complete-booking):', err);
    return { success: false, error: err.message };
  }
});

// Get completed events statistics
ipcMain.handle('get-completed-stats', async () => {
  try {
    console.log('Fetching completed events statistics...');
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_completed,
        COALESCE(SUM(total_price), 0) as total_revenue,
        COALESCE(AVG(event_rating), 0) as avg_rating
      FROM bookings
      WHERE booking_status = 'completed'
    `);
    
    if (result.rows.length > 0) {
      const stats = result.rows[0];
      return { 
        success: true, 
        data: {
          totalCompleted: parseInt(stats.total_completed),
          totalRevenue: parseFloat(stats.total_revenue),
          avgRating: parseFloat(stats.avg_rating).toFixed(1)
        }
      };
    } else {
      return { success: true, data: { totalCompleted: 0, totalRevenue: 0, avgRating: 0 } };
    }
  } catch (err) {
    console.error('DB Error (get-completed-stats):', err);
    return { success: false, error: err.message };
  }
});

// Get booking by ID with user data
ipcMain.handle('get-booking-by-id', async (event, bookingId) => {
  try {
    console.log(`Fetching booking with user data: ${bookingId}`);
    const result = await db.query(`
      SELECT 
        b.*,
        u.avatar_url,
        u.email as user_email
      FROM bookings b
      LEFT JOIN usertable u ON b.user_id = u.id
      WHERE b.id = $1
    `, [bookingId]);
    
    if (result.rows.length > 0) {
      console.log('Booking with user data found');
      return result.rows[0];
    } else {
      console.log('Booking not found');
      return null;
    }
  } catch (err) {
    console.error('DB Error (get-booking-by-id):', err);
    return null;
  }
});

// Get bookings statistics
ipcMain.handle('get-booking-stats', async () => {
  try {
    console.log('Fetching booking statistics...');
    const result = await db.query(`
      SELECT 
        booking_status,
        COUNT(*) as count
      FROM bookings
      GROUP BY booking_status
    `);
    
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      total: 0
    };

    result.rows.forEach(row => {
      stats[row.booking_status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    console.log('Stats calculated:', stats);
    return stats;
  } catch (err) {
    console.error('DB Error (get-booking-stats):', err);
    return { pending: 0, approved: 0, rejected: 0, completed: 0, total: 0 };
  }
});

// Set payment deadline when booking is approved
ipcMain.handle('set-payment-deadline', async (event, bookingId) => {
  try {
    console.log(`Setting payment deadline for booking: ${bookingId}`);
    
    const paymentDeadline = new Date(Date.now() + 20 * 60 * 60 * 1000);
    
    const result = await db.query(`
      UPDATE bookings 
      SET payment_deadline = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [paymentDeadline, bookingId]);

    if (result.rows.length > 0) {
      console.log('Payment deadline set successfully');
      return { success: true, booking: result.rows[0] };
    } else {
      console.log('Booking not found');
      return { success: false, error: 'Booking not found' };
    }
  } catch (err) {
    console.error('DB Error (set-payment-deadline):', err);
    return { success: false, error: err.message };
  }
});

// Check and cancel expired bookings
ipcMain.handle('check-expired-bookings', async () => {
  try {
    console.log('Checking for expired bookings...');
    
    const result = await db.query(`
      UPDATE bookings 
      SET booking_status = 'cancelled', 
        updated_at = NOW(),
        cancellation_reason = 'Payment not received within 20-hour deadline'
      WHERE booking_status = 'approved' 
      AND payment_status != 'paid'
      AND payment_deadline IS NOT NULL
      AND payment_deadline < NOW()
      RETURNING id, full_name, user_email
    `);

    if (result.rows.length > 0) {
      console.log(`Cancelled ${result.rows.length} expired bookings`);
      
      result.rows.forEach(async (booking) => {
        await sendBookingCancellationEmail({
          email: booking.user_email,
          full_name: booking.full_name,
          booking_id: booking.id
        });
      });
      
      return { success: true, cancelled: result.rows.length, bookings: result.rows };
    } else {
      console.log('No expired bookings found');
      return { success: true, cancelled: 0, bookings: [] };
    }
  } catch (err) {
    console.error('DB Error (check-expired-bookings):', err);
    return { success: false, error: err.message };
  }
});

// Send booking approval email
ipcMain.handle('send-booking-approval-email', async (event, bookingData) => {
  try {
    console.log(`Sending booking approval email for: ${bookingData.booking_id}`);
    const result = await sendBookingApprovalEmail(bookingData);
    return result;
  } catch (err) {
    console.error('Error sending booking approval email:', err);
    return { success: false, error: err.message };
  }
});

// Send booking rejection email
ipcMain.handle('send-booking-rejection-email', async (event, bookingData) => {
  try {
    console.log(`Sending rejection email for: ${bookingData.booking_id}`);
    const result = await sendBookingRejectionEmail(bookingData);
    return result;
  } catch (err) {
    console.error('Error sending rejection email:', err);
    return { success: false, error: err.message };
  }
});

// Send payment received email
ipcMain.handle('send-payment-received-email', async (event, bookingData) => {
  try {
    console.log(`Sending payment received email for: ${bookingData.booking_id}`);
    const result = await sendPaymentReceivedEmail(bookingData);
    return result;
  } catch (err) {
    console.error('Error sending payment received email:', err);
    return { success: false, error: err.message };
  }
});

// Send booking cancellation email
ipcMain.handle('send-booking-cancellation-email', async (event, bookingData) => {
  try {
    console.log(`Sending cancellation email for: ${bookingData.booking_id}`);
    const result = await sendBookingCancellationEmail(bookingData);
    return result;
  } catch (err) {
    console.error('Error sending cancellation email:', err);
    return { success: false, error: err.message };
  }
});

// Get users by IDs for avatars (backup method)
ipcMain.handle('get-users-by-ids', async (event, userIds) => {
  try {
    console.log('Fetching users by IDs:', userIds);
    
    if (!userIds || userIds.length === 0) {
      return { success: true, data: [] };
    }

    const result = await db.query(`
      SELECT id, email, name, avatar_url, created_at 
      FROM usertable 
      WHERE id = ANY($1::uuid[])
    `, [userIds]);

    console.log(`Found ${result.rows.length} users`);
    return { success: true, data: result.rows };
  } catch (err) {
    console.error('DB Error (get-users-by-ids):', err);
    return { success: false, error: err.message, data: [] };
  }
});

// Get user avatars for multiple users (backup method)
ipcMain.handle('get-user-avatars', async (event, userIds) => {
  try {
    console.log('Fetching user avatars for:', userIds);
    
    if (!userIds || userIds.length === 0) {
      return { success: true, data: {} };
    }

    const result = await db.query(`
      SELECT id, avatar_url 
      FROM usertable 
      WHERE id = ANY($1::uuid[]) AND avatar_url IS NOT NULL
    `, [userIds]);

    const avatars = {};
    result.rows.forEach(user => {
      avatars[user.id] = user.avatar_url;
    });

    console.log(`Found ${result.rows.length} avatars`);
    return { success: true, data: avatars };
  } catch (err) {
    console.error('DB Error (get-user-avatars):', err);
    return { success: false, error: err.message, data: {} };
  }
});

// --------------------------------------------------
// STAFF MANAGEMENT FUNCTIONS
// --------------------------------------------------

// Get all staff members
ipcMain.handle('get-all-staff', async () => {
  try {
    console.log('Fetching all staff members...');
    
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'staff'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('Staff table does not exist');
        return { success: false, error: 'Staff table does not exist', data: [] };
      }
    } catch (checkError) {
      console.error('Error checking staff table:', checkError);
      return { success: false, error: 'Error checking staff table', data: [] };
    }
    
    const result = await db.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        status,
        rejection_reason,
        created_at,
        updated_at
      FROM staff
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} staff members`);
    
    if (result.rows.length > 0) {
      console.log('First staff member data:', {
        id: result.rows[0].id,
        email: result.rows[0].email,
        full_name: result.rows[0].full_name,
        role: result.rows[0].role,
        status: result.rows[0].status,
        created_at: result.rows[0].created_at
      });
    }
    
    return { success: true, data: result.rows };
  } catch (err) {
    console.error('DB Error (get-all-staff):', err);
    return { success: false, error: err.message, data: [] };
  }
});

// Update staff status (approve/reject)
ipcMain.handle('update-staff-status', async (event, staffId, status, rejectionReason = null) => {
  try {
    console.log(`Updating staff ${staffId} status to: ${status}`);
    
    let query;
    let params;

    if (status === 'rejected' && rejectionReason) {
      query = `
        UPDATE staff 
        SET status = $1, rejection_reason = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      params = [status, rejectionReason, staffId];
    } else {
      query = `
        UPDATE staff 
        SET status = $1, rejection_reason = NULL, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      params = [status, staffId];
    }

    const result = await db.query(query, params);
    
    if (result.rows.length > 0) {
      console.log('Staff status updated successfully');
      
      const staff = result.rows[0];
      if (status === 'approved') {
        await sendStaffApprovalEmail({
          email: staff.email,
          full_name: staff.full_name
        });
      } else if (status === 'rejected' && rejectionReason) {
        await sendStaffRejectionEmail({
          email: staff.email,
          full_name: staff.full_name,
          rejection_reason: rejectionReason
        });
      }
      
      return { success: true, staff: result.rows[0] };
    } else {
      console.log('Staff not found');
      return { success: false, error: 'Staff not found' };
    }
  } catch (err) {
    console.error('DB Error (update-staff-status):', err);
    return { success: false, error: err.message };
  }
});

// Get staff statistics
ipcMain.handle('get-staff-stats', async () => {
  try {
    console.log('Fetching staff statistics...');
    const result = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM staff
      GROUP BY status
    `);
    
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    };

    result.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    console.log('Staff stats calculated:', stats);
    return { success: true, data: stats };
  } catch (err) {
    console.error('DB Error (get-staff-stats):', err);
    return { success: false, error: err.message, data: { pending: 0, approved: 0, rejected: 0, total: 0 } };
  }
});

// Delete staff member
ipcMain.handle('delete-staff', async (event, staffId) => {
  try {
    console.log(`Deleting staff member: ${staffId}`);
    
    const result = await db.query(`
      DELETE FROM staff 
      WHERE id = $1
      RETURNING id, email, full_name
    `, [staffId]);

    if (result.rows.length > 0) {
      console.log('Staff member deleted successfully');
      return { success: true, deletedStaff: result.rows[0] };
    } else {
      console.log('Staff not found');
      return { success: false, error: 'Staff not found' };
    }
  } catch (err) {
    console.error('DB Error (delete-staff):', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// DATABASE HANDLERS - USER MANAGEMENT
// --------------------------------------------------

// Get all users
ipcMain.handle('get-all-users', async () => {
  try {
    console.log('Fetching all users...');
    const result = await db.query(`
      SELECT 
        id,
        name,
        email,
        status,
        avatar_url,
        created_at,
        updated_at
      FROM usertable
      ORDER BY created_at DESC
    `);
    console.log(`Found ${result.rows.length} users`);
    return { success: true, data: result.rows };
  } catch (err) {
    console.error('DB Error (get-all-users):', err);
    return { success: false, error: err.message, data: [] };
  }
});

// Update user status (block/unblock)
ipcMain.handle('update-user-status', async (event, userId, status) => {
  try {
    console.log(`Updating user ${userId} status to: ${status}`);
    
    const result = await db.query(`
      UPDATE usertable 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, email, status, avatar_url, created_at, updated_at
    `, [status, userId]);

    if (result.rows.length > 0) {
      console.log('User status updated successfully');
      return { success: true, user: result.rows[0] };
    } else {
      console.log('User not found');
      return { success: false, error: 'User not found' };
    }
  } catch (err) {
    console.error('DB Error (update-user-status):', err);
    return { success: false, error: err.message };
  }
});

// Get user statistics
ipcMain.handle('get-user-stats', async () => {
  try {
    console.log('Fetching user statistics...');
    
    const totalResult = await db.query('SELECT COUNT(*) as total FROM usertable');
    const totalUsers = parseInt(totalResult.rows[0].total);
    
    const activeResult = await db.query(`
      SELECT COUNT(DISTINCT user_id) as active_count 
      FROM bookings 
      WHERE user_id IS NOT NULL
    `);
    const activeUsers = parseInt(activeResult.rows[0].active_count);
    
    const stats = {
      active: activeUsers,
      total: totalUsers
    };

    console.log('User stats calculated:', stats);
    return { success: true, data: stats };
  } catch (err) {
    console.error('DB Error (get-user-stats):', err);
    return { success: false, error: err.message, data: { active: 0, total: 0 } };
  }
});

// Get user bookings count
ipcMain.handle('get-user-booking-count', async (event, userId) => {
  try {
    console.log(`Fetching booking count for user: ${userId}`);
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE user_id = $1
    `, [userId]);
    
    return { success: true, count: parseInt(result.rows[0]?.count || 0) };
  } catch (err) {
    console.error('DB Error (get-user-booking-count):', err);
    return { success: false, error: err.message, count: 0 };
  }
});

// --------------------------------------------------
// AUTHENTICATION HANDLERS
// --------------------------------------------------

// Check if user is blocked
ipcMain.handle('check-user-status', async (event, userId) => {
  try {
    console.log(`Checking status for user: ${userId}`);
    const result = await db.query(`
      SELECT status 
      FROM usertable 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length > 0) {
      const status = result.rows[0].status;
      console.log(`User ${userId} status: ${status}`);
      return { success: true, status: status, isBlocked: status === 'blocked' };
    } else {
      console.log('User not found');
      return { success: false, error: 'User not found' };
    }
  } catch (err) {
    console.error('DB Error (check-user-status):', err);
    return { success: false, error: err.message };
  }
});

// Get user by email for login validation
ipcMain.handle('get-user-by-email', async (event, email) => {
  try {
    console.log(`Finding user by email: ${email}`);
    const result = await db.query(`
      SELECT id, name, email, status, avatar_url, password
      FROM usertable 
      WHERE email = $1
    `, [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log(`User found: ${user.name} (Status: ${user.status})`);
      return { success: true, user: user };
    } else {
      console.log('User not found');
      return { success: false, error: 'User not found' };
    }
  } catch (err) {
    console.error('DB Error (get-user-by-email):', err);
    return { success: false, error: err.message };
  }
});

// Test database connection
ipcMain.handle('test-db-connection', async () => {
  try {
    const result = await db.query('SELECT NOW() as current_time');
    return { success: true, time: result.rows[0].current_time };
  } catch (err) {
    console.error('Database connection error:', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// DASHBOARD ANALYTICS
// --------------------------------------------------

ipcMain.handle('get-dashboard-analytics', async () => {
  try {
    console.log('Fetching dashboard analytics...');
    
    const monthlyBookings = await db.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);

    const revenueData = await db.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(total_price), 0) as revenue
      FROM bookings
      WHERE payment_status = 'paid' 
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);

    const packageData = await db.query(`
      SELECT 
        food_package,
        COUNT(*) as count
      FROM bookings
      WHERE food_package IS NOT NULL
      GROUP BY food_package
      ORDER BY count DESC
      LIMIT 5
    `);

    return {
      success: true,
      data: {
        monthlyBookings: monthlyBookings.rows,
        revenueData: revenueData.rows,
        packageData: packageData.rows
      }
    };
  } catch (err) {
    console.error('DB Error (get-dashboard-analytics):', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// EXPORT FUNCTIONS
// --------------------------------------------------

// Export bookings to CSV
ipcMain.handle('export-bookings-to-csv', async (event, filters = {}) => {
  try {
    console.log('Exporting bookings to CSV...');
    
    let query = `
      SELECT 
        id,
        full_name,
        contact_number,
        event_type,
        event_date,
        start_time,
        end_time,
        location,
        food_package,
        guest_count,
        package_price,
        service_charge,
        total_price,
        booking_status,
        payment_status,
        created_at
      FROM bookings
    `;
    
    const params = [];
    
    if (filters.status && filters.status !== 'all') {
      query += ` WHERE booking_status = $1`;
      params.push(filters.status);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await db.query(query, params);
    
    const headers = ['ID', 'Name', 'Contact', 'Event Type', 'Event Date', 'Start Time', 'End Time', 'Location', 'Package', 'Guests', 'Package Price', 'Service Charge', 'Total Price', 'Status', 'Payment', 'Created Date'];
    const csvData = result.rows.map(booking => [
      booking.id,
      `"${booking.full_name}"`,
      `"${booking.contact_number}"`,
      `"${booking.event_type}"`,
      booking.event_date ? new Date(booking.event_date).toLocaleDateString() : 'N/A',
      booking.start_time,
      booking.end_time,
      `"${booking.location}"`,
      `"${booking.food_package}"`,
      booking.guest_count,
      booking.package_price,
      booking.service_charge,
      booking.total_price,
      booking.booking_status,
      booking.payment_status,
      new Date(booking.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');
    
    return { success: true, data: csvContent, count: result.rows.length };
  } catch (err) {
    console.error('DB Error (export-bookings-to-csv):', err);
    return { success: false, error: err.message };
  }
});

// Export users to CSV
ipcMain.handle('export-users-to-csv', async () => {
  try {
    console.log('Exporting users to CSV...');
    
    const result = await db.query(`
      SELECT 
        id,
        name,
        email,
        status,
        created_at
      FROM usertable
      ORDER BY created_at DESC
    `);
    
    const headers = ['ID', 'Name', 'Email', 'Status', 'Created Date'];
    const csvData = result.rows.map(user => [
      user.id,
      `"${user.name}"`,
      `"${user.email}"`,
      user.status,
      new Date(user.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');
    
    return { success: true, data: csvContent, count: result.rows.length };
  } catch (err) {
    console.error('DB Error (export-users-to-csv):', err);
    return { success: false, error: err.message };
  }
});

// Export staff to CSV
ipcMain.handle('export-staff-to-csv', async () => {
  try {
    console.log('Exporting staff to CSV...');
    
    const result = await db.query(`
      SELECT 
        id,
        email,
        full_name,
        role,
        status,
        rejection_reason,
        created_at
      FROM staff
      ORDER BY created_at DESC
    `);
    
    const headers = ['ID', 'Email', 'Full Name', 'Role', 'Status', 'Rejection Reason', 'Created Date'];
    const csvData = result.rows.map(staff => [
      staff.id,
      `"${staff.email}"`,
      `"${staff.full_name}"`,
      staff.role,
      staff.status,
      `"${staff.rejection_reason || ''}"`,
      new Date(staff.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');
    
    return { success: true, data: csvContent, count: result.rows.length };
  } catch (err) {
    console.error('DB Error (export-staff-to-csv):', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// BACKUP FUNCTIONS
// --------------------------------------------------

ipcMain.handle('backup-database', async () => {
  try {
    console.log('Creating database backup...');
    
    const bookings = await db.query('SELECT * FROM bookings ORDER BY created_at DESC');
    const users = await db.query('SELECT * FROM usertable ORDER BY created_at DESC');
    const staff = await db.query('SELECT * FROM staff ORDER BY created_at DESC');
    
    const backupData = {
      timestamp: new Date().toISOString(),
      bookings: bookings.rows,
      users: users.rows,
      staff: staff.rows
    };
    
    return { 
      success: true, 
      data: backupData,
      stats: {
        bookings: bookings.rows.length,
        users: users.rows.length,
        staff: staff.rows.length
      }
    };
  } catch (err) {
    console.error('DB Error (backup-database):', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// NOTIFICATION FUNCTIONS
// --------------------------------------------------

ipcMain.handle('send-notification', async (event, title, body, type = 'info') => {
  try {
    console.log(`Sending notification: ${title}`);
    console.log(`Notification: ${title} - ${body} (${type})`);
    
    return { success: true, message: 'Notification sent' };
  } catch (err) {
    console.error('Error sending notification:', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// SETTINGS FUNCTIONS
// --------------------------------------------------

ipcMain.handle('get-settings', async () => {
  try {
    console.log('Getting application settings...');
    
    const settings = {
      company_name: "Zaf's Kitchen",
      email: "zafskitchen95@gmail.com",
      phone: "0917 123 4567",
      payment_deadline_hours: 20,
      auto_cancel_expired: true,
      send_email_notifications: true,
      default_service_charges: {
        delivery: 500,
        setup: 1000,
        overtime: 2000
      }
    };
    
    return { success: true, data: settings };
  } catch (err) {
    console.error('Error getting settings:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-settings', async (event, settings) => {
  try {
    console.log('Updating application settings...');
    
    console.log('Updated settings:', settings);
    
    return { success: true, message: 'Settings updated successfully' };
  } catch (err) {
    console.error('Error updating settings:', err);
    return { success: false, error: err.message };
  }
});

// --------------------------------------------------
// LOGOUT FUNCTION
// --------------------------------------------------

ipcMain.handle('quit-app', async () => {
  try {
    console.log('Quitting application...');
    app.quit();
    return { success: true };
  } catch (err) {
    console.error('Error quitting app:', err);
    return { success: false, error: err.message };
  }
});

console.log('Main process initialized with auto-start server feature and loading window');