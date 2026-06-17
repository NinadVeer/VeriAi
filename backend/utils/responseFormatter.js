/**
 * utils/responseFormatter.js
 * Consistent JSON response helpers used by all controllers.
 *
 * All API responses follow this shape:
 *   Success: { success: true,  data: {...},         timestamp }
 *   Error:   { success: false, error: { message },  timestamp }
 */

'use strict';

function sendSuccess(res, data = {}, status = 200) {
  return res.status(status).json({
    success:   true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendError(res, message = 'An error occurred', status = 500) {
  return res.status(status).json({
    success:   false,
    error:     { message },
    timestamp: new Date().toISOString(),
  });
}

module.exports = { sendSuccess, sendError };
