/**
 * OneSignal Push Notification Service
 *
 * Sends mobile push notifications via the OneSignal REST API.
 *
 * The mobile app registers each logged-in user with OneSignal using
 * `OneSignal.login(user.id)` — this sets the OneSignal `external_id` alias to
 * the backend `User._id`. We therefore target recipients by their User._id
 * (as the OneSignal `external_id` alias), so no per-device token bookkeeping is
 * required on the server.
 *
 * Configuration (env):
 *   ONESIGNAL_APP_ID        — OneSignal application id
 *   ONESIGNAL_REST_API_KEY  — OneSignal REST API key (secret)
 *   ONESIGNAL_AUTH_SCHEME   — 'Basic' (classic keys) or 'Key' (new keys)
 */

const axios = require('axios');
const config = require('../config/environment');

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

// OneSignal allows up to 2,000 alias entries per request.
const MAX_ALIASES_PER_REQUEST = 2000;

function isReady() {
  return Boolean(config.ONESIGNAL_APP_ID && config.ONESIGNAL_REST_API_KEY);
}

function authHeader() {
  const scheme = config.ONESIGNAL_AUTH_SCHEME || 'Basic';
  return `${scheme} ${config.ONESIGNAL_REST_API_KEY}`;
}

/**
 * OneSignal requires custom `data` values to be plain (string-safe) values.
 * Convert objects/arrays to JSON strings and drop nullish entries.
 */
function sanitizeData(data = {}) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Send a push notification to one or more users by external_id (User._id).
 *
 * @param {string[]} externalIds - Backend User._id values (as strings).
 * @param {string} title - Notification heading.
 * @param {string} message - Notification body.
 * @param {Object} [data] - Custom data delivered with the push (e.g. applicationId, type).
 * @returns {Promise<{success: boolean, sent?: number, error?: string, provider: string}>}
 */
async function sendToExternalIds(externalIds, title, message, data = {}) {
  if (!isReady()) {
    return { success: false, error: 'OneSignal not configured', provider: 'OneSignal' };
  }

  const ids = [...new Set((externalIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) {
    return { success: false, error: 'No recipients', provider: 'OneSignal' };
  }

  const payloadData = sanitizeData(data);
  const batches = chunk(ids, MAX_ALIASES_PER_REQUEST);

  let totalSent = 0;
  let lastError = null;

  for (const batch of batches) {
    try {
      const response = await axios.post(
        ONESIGNAL_API_URL,
        {
          app_id: config.ONESIGNAL_APP_ID,
          target_channel: 'push',
          include_aliases: { external_id: batch },
          headings: { en: title },
          contents: { en: message },
          data: payloadData
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: authHeader()
          },
          timeout: 15000
        }
      );

      const recipients = response.data?.recipients ?? 0;
      totalSent += recipients;

      // OneSignal returns 200 with an `errors` field when some aliases are
      // not subscribed — that is not a hard failure for the rest.
      if (response.data?.errors) {
        console.warn('⚠️ [ONESIGNAL] Partial errors:', JSON.stringify(response.data.errors));
      }
    } catch (error) {
      lastError = error.response?.data?.errors || error.message;
      console.error('❌ [ONESIGNAL] Push send failed:', JSON.stringify(lastError));
    }
  }

  if (totalSent > 0) {
    return { success: true, sent: totalSent, provider: 'OneSignal' };
  }

  return {
    success: false,
    error: lastError ? JSON.stringify(lastError) : 'No recipients reached',
    provider: 'OneSignal'
  };
}

module.exports = {
  isReady,
  sendToExternalIds
};
