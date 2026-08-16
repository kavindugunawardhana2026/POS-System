'use strict';

/**
 * Firebase Firestore License Validation
 *
 * This module is used ONLY in Electron's main process.
 * It handles:
 *   1. Querying Firestore to validate a license key
 *   2. Caching the result with a 3-day grace period
 *   3. Offline grace-period enforcement
 */

const { initializeApp }           = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const path    = require('path');
const fs      = require('fs');

// ── Firebase Configuration ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyDQOO_Evu8Om9xx7KTOFfBakibJ6QM7PaE',
  authDomain:        'pos-system-license.firebaseapp.com',
  projectId:         'pos-system-license',
  storageBucket:     'pos-system-license.firebasestorage.app',
  messagingSenderId: '222025185405',
  appId:             '1:222025185405:web:0ee0a0a9b290d0446e9914',
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ── Grace period: 3 days in milliseconds ─────────────────────────────────────
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

// ── License cache file ────────────────────────────────────────────────────────
let _cacheFilePath = null;

function setCacheFilePath(userDataPath) {
  _cacheFilePath = path.join(userDataPath, 'license-cache.json');
}

function readCache() {
  try {
    if (!_cacheFilePath || !fs.existsSync(_cacheFilePath)) return null;
    return JSON.parse(fs.readFileSync(_cacheFilePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(licenseKey, expiryDate, customerName) {
  try {
    const data = {
      licenseKey,
      expiryDate,
      customerName,
      lastCheckedAt: new Date().toISOString(),
    };
    fs.writeFileSync(_cacheFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[License] Failed to write cache:', err.message);
  }
}

function clearCache() {
  try {
    if (_cacheFilePath && fs.existsSync(_cacheFilePath)) {
      fs.unlinkSync(_cacheFilePath);
    }
  } catch { /* ignore */ }
}

// ── Core validation ───────────────────────────────────────────────────────────

/**
 * Validate a license key against Firestore.
 *
 * Returns:
 *   { valid: true,  licenseKey, expiryDate, customerName }   — Active & not expired
 *   { valid: false, reason: 'not_found' | 'inactive' | 'expired', expiryDate? }
 */
async function validateKeyOnline(licenseKey) {
  const q = query(
    collection(db, 'licenses'),
    where('licenseKey', '==', licenseKey.trim().toUpperCase())
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { valid: false, reason: 'not_found' };
  }

  const doc  = snapshot.docs[0].data();
  const expiryDate    = doc.expiryDate;   // 'YYYY-MM-DD'
  const isActive      = doc.isActive;
  const customerName  = doc.customerName || 'Customer';

  if (!isActive) {
    return { valid: false, reason: 'inactive', expiryDate };
  }

  const today  = new Date().toISOString().slice(0, 10);
  if (expiryDate < today) {
    return { valid: false, reason: 'expired', expiryDate };
  }

  return { valid: true, licenseKey, expiryDate, customerName };
}

/**
 * Full license check — called at Electron startup.
 *
 * Strategy:
 *  1. Load saved license key from license.json
 *  2. Try to validate online
 *     a. Valid → update cache → return VALID
 *     b. Invalid (not_found / inactive / expired) → clear cache → return INVALID
 *     c. Network error → check grace period from cache
 *  3. No saved key → return NO_KEY
 *
 * @param {string} userDataPath - Electron app.getPath('userData')
 * @param {string|null} savedKey - the license key stored in license.json (or null)
 * @returns {{ status: 'valid'|'no_key'|'expired'|'grace', expiryDate?, customerName? }}
 */
async function checkLicenseAtBoot(userDataPath, savedKey) {
  setCacheFilePath(userDataPath);

  if (!savedKey) {
    return { status: 'no_key' };
  }

  try {
    const result = await validateKeyOnline(savedKey);

    if (result.valid) {
      writeCache(savedKey, result.expiryDate, result.customerName);
      return { status: 'valid', expiryDate: result.expiryDate, customerName: result.customerName };
    } else {
      clearCache();
      return { status: 'expired', reason: result.reason, expiryDate: result.expiryDate };
    }
  } catch (networkErr) {
    // Offline / network error — check grace period
    console.warn('[License] Network error, checking grace period:', networkErr.message);
    const cache = readCache();

    if (!cache) {
      // No cache and no network — cannot verify → fail safe
      return { status: 'expired', reason: 'offline_no_cache' };
    }

    const lastChecked = new Date(cache.lastCheckedAt).getTime();
    const now         = Date.now();

    if (now - lastChecked <= GRACE_PERIOD_MS) {
      // Within 3-day grace period → allow
      const daysLeft = Math.ceil((GRACE_PERIOD_MS - (now - lastChecked)) / (24 * 60 * 60 * 1000));
      return {
        status:       'grace',
        expiryDate:   cache.expiryDate,
        customerName: cache.customerName,
        daysLeft,
      };
    } else {
      // Grace period expired → block
      return { status: 'expired', reason: 'grace_period_expired', expiryDate: cache.expiryDate };
    }
  }
}

/**
 * Validate a brand-new key entered by the user on the Activation Screen.
 * On success, saves the key to license.json and updates the cache.
 */
async function activateKey(userDataPath, licenseFilePath, licenseKey) {
  setCacheFilePath(userDataPath);
  const result = await validateKeyOnline(licenseKey);

  if (!result.valid) {
    return { success: false, reason: result.reason, expiryDate: result.expiryDate };
  }

  // Save to license.json
  const licenseData = {
    licenseKey:   result.licenseKey,
    activatedAt:  new Date().toISOString(),
  };
  fs.writeFileSync(licenseFilePath, JSON.stringify(licenseData, null, 2), 'utf8');

  // Update cache
  writeCache(result.licenseKey, result.expiryDate, result.customerName);

  return { success: true, expiryDate: result.expiryDate, customerName: result.customerName };
}

module.exports = { checkLicenseAtBoot, activateKey };
