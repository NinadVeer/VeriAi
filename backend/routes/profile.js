/**
 * routes/profile.js
 * GET /api/profile
 */

'use strict';

const { Router }      = require('express');
const { requireAuth } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

const router = Router();

router.get('/', requireAuth, profileController.get);

module.exports = router;
