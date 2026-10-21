const PricingRule = require("../models/PricingRule");

const getActiveRule = async (vehicleType, snapshot) => {
  if (snapshot && Number.isFinite(Number(snapshot.baseRate)) && Number.isFinite(Number(snapshot.ratePerHour))) {
    return {
      baseRate: Number(snapshot.baseRate),
      ratePerHour: Number(snapshot.ratePerHour),
      extraRatePerHour: Number(snapshot.extraRatePerHour) || 0,
      gracePeriodMinutes: Number(snapshot.exitGracePeriodMinutes) || 0
    };
  }
  const rule = await PricingRule.findOne({
    vehicleType: vehicleType.toUpperCase(),
    status: "ACTIVE"
  });
  if (!rule) throw new Error("Active pricing rule not found");
  return rule;
};

const calculateReservationFee = async (vehicleType, reservationStartTime, expectedEndTime, pricingSnapshot) => {
  const rule = await getActiveRule(vehicleType, pricingSnapshot);
  const start = new Date(reservationStartTime);
  const end = new Date(expectedEndTime);
  const reservedMinutes = Math.ceil((end - start) / 60000);
  if (!Number.isFinite(reservedMinutes) || reservedMinutes <= 0) throw new Error("Reservation duration is invalid");
  const billedHours = Math.ceil(reservedMinutes / 60);
  const baseAmount = rule.baseRate + billedHours * rule.ratePerHour;
  return {
    baseAmount,
    reservedMinutes,
    billedHours,
    baseRate: rule.baseRate,
    ratePerHour: rule.ratePerHour,
    extraRatePerHour: rule.extraRatePerHour,
    exitGracePeriodMinutes: rule.gracePeriodMinutes
  };
};

const calculateExitFee = async (vehicleType, reservationAmount, reservationStartTime, expectedEndTime, actualExitTime, actualEntryTime = reservationStartTime, pricingSnapshot) => {
  const rule = await getActiveRule(vehicleType, pricingSnapshot);
  const exit = new Date(actualExitTime);
  const expectedEnd = new Date(expectedEndTime);
  const start = new Date(reservationStartTime);
  const actualEntry = new Date(actualEntryTime);
  if (Number.isNaN(exit.getTime()) || Number.isNaN(expectedEnd.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(actualEntry.getTime()) || exit <= actualEntry) {
    throw new Error("Exit time must be after the actual entry time");
  }
  const minutesLate = Math.max(0, Math.ceil((exit - expectedEnd) / 60000));
  const chargeableMinutes = Math.max(0, minutesLate - rule.gracePeriodMinutes);
  const extraHours = chargeableMinutes > 0 ? Math.ceil(chargeableMinutes / 60) : 0;
  const baseAmount = Number.isFinite(Number(reservationAmount))
    ? Number(reservationAmount)
    : (await calculateReservationFee(vehicleType, start, expectedEnd, pricingSnapshot)).baseAmount;
  const extraAmount = extraHours * rule.extraRatePerHour;
  return {
    baseAmount,
    extraAmount,
    totalAmount: baseAmount + extraAmount,
    minutesLate,
    chargeableMinutes,
    extraHours,
    extraRatePerHour: rule.extraRatePerHour,
    exitGracePeriodMinutes: rule.gracePeriodMinutes
  };
};

// Kept for the demo simulator and older internal callers.
const calculateParkingFee = async (vehicleType, entryTime, expectedEndTime, actualExitTime) => {
  const reserved = await calculateReservationFee(vehicleType, entryTime, expectedEndTime);
  return calculateExitFee(vehicleType, reserved.baseAmount, entryTime, expectedEndTime, actualExitTime);
};

module.exports = { calculateReservationFee, calculateExitFee, calculateParkingFee };
