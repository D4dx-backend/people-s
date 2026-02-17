/**
 * Firebase Cloud Messaging Service
 * Handles push notifications via Firebase Admin SDK
 */

let admin;
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Supports both service account JSON file and individual env vars
 */
function initializeFirebase() {
  if (initialized) return;

  try {
    admin = require('firebase-admin');

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      // Use service account JSON file
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      initialized = true;
      console.log('✅ Firebase initialized with service account file');
    } else if (projectId && privateKey && clientEmail) {
      // Use individual environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail
        })
      });
      initialized = true;
      console.log('✅ Firebase initialized with env credentials');
    } else {
      console.warn('⚠️ Firebase not configured — push notifications will be skipped. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL or FIREBASE_SERVICE_ACCOUNT_PATH');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
  }
}

// Initialize on load
initializeFirebase();

/**
 * Check if Firebase is ready
 */
function isReady() {
  return initialized && admin;
}

/**
 * Send push notification to a single device
 * @param {string} fcmToken - Device FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Custom data payload
 * @returns {Promise<Object>} Send result
 */
async function sendPushToDevice(fcmToken, title, body, data = {}) {
  if (!isReady()) {
    return { success: false, error: 'Firebase not initialized', provider: 'Firebase' };
  }

  if (!fcmToken) {
    return { success: false, error: 'No FCM token provided', provider: 'Firebase' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'people_erp_default',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    return {
      success: true,
      messageId: response,
      provider: 'Firebase'
    };
  } catch (error) {
    console.error('❌ Firebase push error:', error.message);
    // Handle invalid token (unregistered device)
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      return {
        success: false,
        error: 'Invalid or expired FCM token',
        tokenExpired: true,
        provider: 'Firebase'
      };
    }
    return {
      success: false,
      error: error.message,
      provider: 'Firebase'
    };
  }
}

/**
 * Send push notification to multiple devices
 * @param {Array<string>} fcmTokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Custom data payload
 * @returns {Promise<Object>} Bulk send result
 */
async function sendPushToMultiple(fcmTokens, title, body, data = {}) {
  if (!isReady()) {
    return {
      success: false,
      error: 'Firebase not initialized',
      provider: 'Firebase',
      results: fcmTokens.map(() => ({ success: false, error: 'Firebase not initialized' }))
    };
  }

  const validTokens = fcmTokens.filter(t => t);
  if (validTokens.length === 0) {
    return {
      success: false,
      error: 'No valid FCM tokens',
      provider: 'Firebase',
      results: []
    };
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'people_erp_default',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      tokens: validTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const results = response.responses.map((resp, idx) => ({
      success: resp.success,
      messageId: resp.messageId || null,
      error: resp.error ? resp.error.message : null,
      token: validTokens[idx]
    }));

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      provider: 'Firebase',
      results
    };
  } catch (error) {
    console.error('❌ Firebase bulk push error:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'Firebase',
      results: validTokens.map(() => ({ success: false, error: error.message }))
    };
  }
}

module.exports = {
  isReady,
  sendPushToDevice,
  sendPushToMultiple
};
