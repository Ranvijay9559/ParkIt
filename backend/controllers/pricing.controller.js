const PricingRule = require("../models/PricingRule");

// Create pricing rule
const createPricingRule = async (req, res) => {
  try {
    const {
      vehicleType,
      baseRate,
      ratePerHour,
      gracePeriodMinutes,
      extraRatePerHour
    } = req.body;

    if (
      !vehicleType ||
      baseRate === undefined ||
      ratePerHour === undefined
    ) {
      return res.status(400).json({
        message: "vehicleType, baseRate and ratePerHour are required"
      });
    }

    const numericValues = [baseRate, ratePerHour, gracePeriodMinutes ?? 15, extraRatePerHour ?? 0];
    if (numericValues.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      return res.status(400).json({ message: "Pricing values must be valid non-negative numbers" });
    }

    const normalizedType = vehicleType.toUpperCase();
    const pricingRule = await PricingRule.findOneAndUpdate(
      { vehicleType: normalizedType },
      {
        vehicleType: normalizedType,
        baseRate,
        ratePerHour,
        gracePeriodMinutes,
        extraRatePerHour,
        status: "ACTIVE"
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({
      message: "Pricing rule saved successfully",
      pricingRule
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create pricing rule",
      error: error.message
    });
  }
};


// Get all pricing rules
const getPricingRules = async (req, res) => {
  try {
    const pricingRules = await PricingRule.find().sort({
      vehicleType: 1
    });

    res.json(pricingRules);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch pricing rules",
      error: error.message
    });
  }
};


// Get active pricing rule for vehicle type
const getPricingRuleByVehicleType = async (req, res) => {
  try {
    const { vehicleType } = req.params;

    const pricingRule = await PricingRule.findOne({
      vehicleType: vehicleType.toUpperCase(),
      status: "ACTIVE"
    });

    if (!pricingRule) {
      return res.status(404).json({
        message: "Active pricing rule not found"
      });
    }

    res.json(pricingRule);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch pricing rule",
      error: error.message
    });
  }
};


module.exports = {
  createPricingRule,
  getPricingRules,
  getPricingRuleByVehicleType
};
