const express = require("express");

const {
  createPricingRule,
  getPricingRules,
  getPricingRuleByVehicleType
} = require("../controllers/pricing.controller");

const protect = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

const router = express.Router();

// Admin only
router.post("/", protect, admin, createPricingRule);

// View pricing
router.get("/", getPricingRules);

router.get("/:vehicleType", getPricingRuleByVehicleType);

module.exports = router;