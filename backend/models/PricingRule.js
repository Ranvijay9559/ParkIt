const mongoose = require("mongoose");

const pricingRuleSchema = new mongoose.Schema(
  {
    vehicleType: {
      type: String,
      enum: ["CAR", "BIKE", "SUV", "TRUCK", "OTHER"],
      required: true
    },

    baseRate: {
      type: Number,
      required: true,
      min: 0
    },

    ratePerHour: {
      type: Number,
      required: true,
      min: 0
    },

    gracePeriodMinutes: {
      type: Number,
      default: 15,
      min: 0
    },

    extraRatePerHour: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PricingRule", pricingRuleSchema);