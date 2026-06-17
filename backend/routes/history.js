/**
 * routes/history.js
 * GET /api/history?page=1&limit=20
 */

'use strict';

const { Router }      = require('express');
const { requireAuth } = require('../middleware/auth');
const historyController = require('../controllers/historyController');

const router = Router();

router.get('/', requireAuth, historyController.list);

module.exports = router;
