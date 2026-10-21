const Booking = require("../models/Booking");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLot = require("../models/ParkingLot");
const { notifyParkingChange } = require("./realtime.service");

const ARRIVAL_GRACE_MINUTES = 20;
const graceMs = ARRIVAL_GRACE_MINUTES * 60 * 1000;

const calculateArrivalGraceMinutes = (durationMinutes) => Math.min(Math.ceil(durationMinutes / 3), ARRIVAL_GRACE_MINUTES);

const getExpiryConditions = (now) => ({
  status: "CONFIRMED",
  $or: [
    { arrivalDeadline: { $lte: now } },
    { arrivalDeadline: { $exists: false }, startTime: { $lte: new Date(now.getTime() - graceMs) } },
    { arrivalDeadline: null, startTime: { $lte: new Date(now.getTime() - graceMs) } }
  ]
});

const expireMissedReservations = async (now = new Date()) => {
  const dueBookings = await Booking.find(getExpiryConditions(now))
    .select("_id parkingSlotId parkingLotId reservationPaymentStatus")
    .lean();
  let expired = 0;

  for (const due of dueBookings) {
    // Claim each booking atomically so a concurrent entry or cancellation wins
    // cleanly and the same reserved slot is never released twice.
    const cancelled = await Booking.findOneAndUpdate(
      { _id: due._id, ...getExpiryConditions(now) },
      { $set: {
        status: "CANCELLED",
        cancellationReason: "NO_SHOW",
        ...(due.reservationPaymentStatus === "DEMO_PAID" ? { reservationPaymentStatus: "DEMO_FORFEITED" } : {})
      } },
      { new: true }
    );
    if (!cancelled) continue;

    const released = await ParkingSlot.findOneAndUpdate(
      { _id: due.parkingSlotId, status: "RESERVED" },
      { $set: { status: "AVAILABLE" } },
      { new: true }
    );
    if (released) {
      await ParkingLot.updateOne({ _id: due.parkingLotId }, { $inc: { availableSlots: 1 } });
      notifyParkingChange(due.parkingLotId, "RESERVATION_EXPIRED");
    }
    expired += 1;
  }

  return { expired };
};

module.exports = { ARRIVAL_GRACE_MINUTES, calculateArrivalGraceMinutes, expireMissedReservations };
