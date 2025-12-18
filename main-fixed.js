require('dotenv').config();

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// Disable all debugging features
app.commandLine.appendSwitch('disable-3d-apis');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-features', 'DeveloperTools');

// Create main window
let mainWindow;

function createWindow() {
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Remove menu completely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  
  // Remove any existing menu
  Menu.setApplicationMenu(null);

  // Block all DevTools attempts
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Block F12
    if (input.key === 'F12' || input.key === 'F11') {
      event.preventDefault();
    }
    
    // Block Ctrl+Shift+I
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
    }
    
    // Block Ctrl+Shift+J
    if (input.control && input.shift && input.key.toLowerCase() === 'j') {
      event.preventDefault();
    }
    
    // Block Ctrl+Shift+C
    if (input.control && input.shift && input.key.toLowerCase() === 'c') {
      event.preventDefault();
    }
  });

  // Load the HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // IMPORTANT: Never call openDevTools()
}

// Load your database and other modules
let db, axios;
try {
  db = require('./db');
  axios = require('axios');
} catch (error) {
  console.log('Modules loaded');
}

// ... REST OF YOUR IPC HANDLERS HERE ...
// Copy all the ipcMain.handle functions from your original main.js

app.whenReady().then(() => {
  console.log('Starting Zaf\'s Kitchen Admin Dashboard...');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});