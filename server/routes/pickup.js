const express = require('express');
const { redeem } = require('../workflow/pickupService');
const { ServiceError } = require('../workflow/errors');
const { sendError } = require('../security/rbac');
const { limiter, handle } = require('./aiHttp');

const router = express.Router();
router.use(limiter(Number(process.env.PICKUP_RATE_LIMIT_PER_MIN) || 20));

router.post('/redeem', handle(async (req, res) => {
  try {
    const out = redeem(req.body?.token, req);
    res.json(out);
  } catch (err) {
    if (err instanceof ServiceError) return sendError(res, err.status, err.code, err.message);
    throw err;
  }
}));

module.exports = router;
