'use strict';

/**
 * PositiQ — Electron Main Process
 *
 * Boot sequence:
 *  1. Create app window (hidden)
 *  2. Read license key from %APPDATA%/PositiQ/license.json
 *  3. Validate with Firebase Firestore (+ 3-day offline grace period)
 *  4a. VALID   → start Express backend → load React frontend UI
 *  4b. NO KEY  → load activation.html
 *  4c. EXPIRED → load expired.html
 */

const {
  app, BrowserWindow, ipcMain, shell, dialog,
} = require('electron');
const path = require('path');
const fs   = require('fs');
const { spawn } = require('child_process');
const { checkLicenseAtBoot, activateKey } = require('./firebase');

// ── Paths ─────────────────────────────────────────────────────────────────────
const USER_DATA_PATH  = app.getPath('userData');
const LICENSE_FILE    = path.join(USER_DATA_PATH, 'license.json');
const SQLITE_DB_PATH  = path.join(USER_DATA_PATH, 'positiq.db');

// ── Is this a production build? ──────────────────────────────────────────────
const IS_PROD = app.isPackaged;

// ── Backend server port ──────────────────────────────────────────────────────
const BACKEND_PORT = 5488; // custom port to avoid conflicts

// ── Backend process reference ────────────────────────────────────────────────
let backendProcess = null;
let mainWindow     = null;

// ─────────────────────────────────────────────────────────────────────────────
// Window helpers
// ─────────────────────────────────────────────────────────────────────────────

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width:           960,
    height:          640,
    minWidth:        800,
    minHeight:       520,
    show:            false,
    frame:           true,
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    icon: IS_PROD
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '..', 'public', 'icon.png'),
    ...options,
  });

  win.once('ready-to-show', () => win.show());
  return win;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load saved license key
// ─────────────────────────────────────────────────────────────────────────────

function readSavedKey() {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    return data.licenseKey || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express backend launcher
// ─────────────────────────────────────────────────────────────────────────────

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendDir = IS_PROD
      ? path.join(process.resourcesPath, 'backend')
      : path.join(__dirname, '..', 'backend');

    const serverScript = path.join(backendDir, 'server.js');
    const nodeExec     = IS_PROD ? process.execPath : 'node';
    const runAsNodeEnv = IS_PROD ? { ELECTRON_RUN_AS_NODE: '1' } : {};

    backendProcess = spawn(nodeExec, [serverScript], {
      cwd: backendDir,
      env: {
        ...process.env,
        PORT:           String(BACKEND_PORT),
        NODE_ENV:       IS_PROD ? 'production' : 'development',
        SQLITE_DB_PATH: SQLITE_DB_PATH,
        ...runAsNodeEnv
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let ready = false;

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      process.stdout.write(`[backend] ${msg}`);
      if (!ready && msg.includes('POS Server running')) {
        ready = true;
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      process.stderr.write(`[backend:err] ${data}`);
    });

    backendProcess.on('error', (err) => {
      if (!ready) reject(err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[backend] exited with code ${code}`);
      if (!ready) reject(new Error(`Backend exited early with code ${code}`));
    });

    // Fallback timeout in case startup log line never fires
    setTimeout(() => {
      if (!ready) { ready = true; resolve(); }
    }, 8000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Run SQLite migrations (on first run or after update)
// ─────────────────────────────────────────────────────────────────────────────

function runMigrations() {
  return new Promise((resolve, reject) => {
    const backendDir   = IS_PROD
      ? path.join(process.resourcesPath, 'backend')
      : path.join(__dirname, '..', 'backend');

    const migrateScript = path.join(backendDir, 'scripts', 'sqlite-migrate.js');
    const nodeExec      = IS_PROD ? process.execPath : 'node';
    const runAsNodeEnv  = IS_PROD ? { ELECTRON_RUN_AS_NODE: '1' } : {};

    const proc = spawn(nodeExec, [migrateScript], {
      cwd:   backendDir,
      env:   { ...process.env, SQLITE_DB_PATH: SQLITE_DB_PATH, ...runAsNodeEnv },
      stdio: 'pipe',
    });

    proc.stdout.on('data', d => process.stdout.write(`[migrate] ${d}`));
    proc.stderr.on('data', d => process.stderr.write(`[migrate:err] ${d}`));

    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Migration failed with exit code ${code}`));
    });

    proc.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Load the React frontend
// ─────────────────────────────────────────────────────────────────────────────

function loadFrontend(win) {
  if (IS_PROD) {
    // In production, load the built React index.html (file://)
    const indexPath = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
    win.loadFile(indexPath);
  } else {
    // In dev, load from Vite dev server
    win.loadURL(`http://localhost:5173`);
    win.webContents.openDevTools();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Show Activation Screen
// ─────────────────────────────────────────────────────────────────────────────

function loadActivationScreen(win) {
  win.setSize(480, 680);
  win.center();
  win.setResizable(false);
  win.loadFile(path.join(__dirname, 'activation.html'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Show Expired Screen
// ─────────────────────────────────────────────────────────────────────────────

function loadExpiredScreen(win, reason, expiryDate) {
  win.setSize(480, 640);
  win.center();
  win.setResizable(false);
  const params = new URLSearchParams();
  if (reason)     params.set('reason', reason);
  if (expiryDate) params.set('expiryDate', expiryDate);
  win.loadFile(path.join(__dirname, 'expired.html'), { search: params.toString() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Launch the full POS app (backend + frontend)
// ─────────────────────────────────────────────────────────────────────────────

async function launchPOSApp(win) {
  win.setSize(1280, 800);
  win.setMinimumSize(900, 600);
  win.setResizable(true);
  win.center();

  try {
    await runMigrations();
    console.log('[main] Migrations complete.');
  } catch (err) {
    dialog.showErrorBox('Database Error', `Failed to initialise database:\n${err.message}`);
    app.quit();
    return;
  }

  try {
    await startBackend();
    console.log(`[main] Backend running on port ${BACKEND_PORT}.`);
  } catch (err) {
    dialog.showErrorBox('Backend Error', `Failed to start the application server:\n${err.message}`);
    app.quit();
    return;
  }

  loadFrontend(win);
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('validate-license', async (_event, key) => {
  try {
    const result = await activateKey(USER_DATA_PATH, LICENSE_FILE, key);
    if (result.success) {
      // Resize window and launch the full app
      setTimeout(() => launchPOSApp(mainWindow), 1500);
    }
    return result;
  } catch (err) {
    return { success: false, reason: 'error', message: err.message };
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

// Open external links from screens
ipcMain.handle('open-external', (_event, url) => shell.openExternal(url));

// ─────────────────────────────────────────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Ensure userData dir exists
  if (!fs.existsSync(USER_DATA_PATH)) {
    fs.mkdirSync(USER_DATA_PATH, { recursive: true });
  }

  mainWindow = createWindow();

  // ── Boot Gate ──────────────────────────────────────────────────────────────
  const savedKey    = readSavedKey();
  let   licenseStatus;

  try {
    licenseStatus = await checkLicenseAtBoot(USER_DATA_PATH, savedKey);
  } catch (err) {
    console.error('[main] License check crashed:', err);
    licenseStatus = { status: 'expired', reason: 'error' };
  }

  console.log('[main] License status:', licenseStatus.status);

  switch (licenseStatus.status) {
    case 'valid':
    case 'grace':
      // Grace period: show a brief warning but allow the app
      await launchPOSApp(mainWindow);
      if (licenseStatus.status === 'grace') {
        // Notify user after window loads
        setTimeout(() => {
          dialog.showMessageBox(mainWindow, {
            type:    'warning',
            title:   'Offline Mode — Grace Period',
            message: `PositiQ is running in offline mode.\n\nYour subscription could not be verified online. You have ${licenseStatus.daysLeft} day(s) remaining in your grace period.\n\nPlease connect to the internet to verify your license.`,
            buttons: ['OK'],
          });
        }, 5000);
      }
      break;

    case 'no_key':
      loadActivationScreen(mainWindow);
      break;

    case 'expired':
    default:
      loadExpiredScreen(mainWindow, licenseStatus.reason, licenseStatus.expiryDate);
      break;
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) app.emit('ready');
});

// Graceful cleanup
process.on('exit', () => {
  if (backendProcess) backendProcess.kill('SIGTERM');
});
