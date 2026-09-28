const PricingRule = require("../models/PricingRule");

const calculateParkingFee = async (
  vehicleType,
  entryTime,
  expectedEndTime,
  actualExitTime
) => {
  const pricingRule = await PricingRule.findOne({
    vehicleType: vehicleType.toUpperCase(),
    status: "ACTIVE"
  });

  if (!pricingRule) {
    throw new Error("Active pricing rule not found");
  }

  const entry = new Date(entryTime);
  const expectedEnd = new Date(expectedEndTime);
  const exit = new Date(actualExitTime);

  if (exit <= entry) {
    throw new Error("Exit time must be after entry time");
  }

  // Calculate actual parking duration in minutes
  const actualMinutes = Math.ceil(
    (exit - entry) / (1000 * 60)
  );

  // Calculate normal parking duration
  const normalMinutes = Math.ceil(
    (expectedEnd - entry) / (1000 * 60)
  );

  // Calculate normal hours
  const normalHours = Math.ceil(normalMinutes / 60);

  const baseAmount =
    pricingRule.baseRate +
    normalHours * pricingRule.ratePerHour;

  let extraAmount = 0;

  // Extra time after expected end
  const extraMinutes = actualMinutes - normalMinutes;

  if (extraMinutes > pricingRule.gracePeriodMinutes) {
    const chargeableExtraMinutes =
      extraMinutes - pricingRule.gracePeriodMinutes;

    const extraHours = Math.ceil(
      chargeableExtraMinutes / 60
    );

    extraAmount =
      extraHours * pricingRule.extraRatePerHour;
  }

  const totalAmount = baseAmount + extraAmount;

  return {
    baseAmount,
    extraAmount,
    totalAmount,
    actualMinutes,
    normalMinutes
  };
};

module.exports = {
  calculateParkingFee
};