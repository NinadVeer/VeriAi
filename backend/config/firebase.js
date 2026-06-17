/**
 * config/firebase.js
 * Initializes the Firebase Admin SDK using a service account JSON file.
 *
 * HOW TO GET YOUR SERVICE ACCOUNT:
 *   Firebase Console → Project Settings → Service Accounts
 *   → Generate new private key → save as config/firebase-service-account.json
 *
 * The Admin SDK gives us server-side token verification without exposing any
 * client-side credentials. This is the ONLY correct way to verify Firebase
 * ID tokens on a backend.
 */

'use strict';

const admin = require('firebase-admin');
const path  = require('path');
const env   = require('./env');

let _auth;
let _initialized = false;
let _initError   = null;

function getAuth() {
  if (_auth) return _auth;
  if (_initError) throw _initError;

  if (!admin.apps.length) {
    try {
      // Support both absolute paths and paths relative to backend root
      const serviceAccountPath = path.isAbsolute(env.FIREBASE_SERVICE_ACCOUNT_PATH)
        ? env.FIREBASE_SERVICE_ACCOUNT_PATH
        : path.resolve(__dirname, '..', env.FIREBASE_SERVICE_ACCOUNT_PATH);

      // Use require() for JSON — throws if file doesn't exist
      const serviceAccount = require(serviceAccountPath); // eslint-disable-line import/no-dynamic-require

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      _initialized = true;
      console.log('✅ Firebase Admin SDK initialized');
    } catch (err) {
      const msg = `Firebase Admin SDK init failed: ${err.message}`;
      console.error('❌ ' + msg);
      console.error(
        '   Make sure your service account JSON exists at:',
        env.FIREBASE_SERVICE_ACCOUNT_PATH
      );

      if (env.IS_PRODUCTION) {
        // Hard fail in production — auth MUST work
        process.exit(1);
      } else {
        // In development, store error and let server start.
        // All protected routes will return 500 until the file is added.
        _initError = new Error(msg);
        return null;
      }
    }
  }

  _auth = admin.auth();
  return _auth;
}

module.exports = { admin, getAuth };

