'use strict';

/**
 * Electron Preload Script
 *
 * Runs in the renderer process (activation.html / expired.html) with
 * contextIsolation: true for security. It exposes ONLY the specific
 * IPC calls that those screens need — nothing else.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posAPI', {
  /**
   * Send a license key to main.js for validation.
   * @param {string} key
   * @returns {Promise<{ success: boolean, reason?: string, expiryDate?: string, customerName?: string }>}
   */
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),

  /**
   * Get app version from main process.
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
