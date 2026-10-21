const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingSession = require("../models/ParkingSession");
const { notifyParkingChange } = require("../services/realtime.service");
const { calculateArrivalGraceMinutes, expireMissedReservations } = require("../services/reservation-expiry.service");
const { calculateReservationFee } = require("../services/fee.service");

const createBooking = async (req, res) => {
  try {
    await expireMissedReservations();
    const {
      vehicleId,
      parkingLotId,
      startTime,
      expectedEndTime
    } = req.body;

    if (
      !vehicleId ||
      !parkingLotId ||
      !startTime ||
      !expectedEndTime
    ) {
      return res.status(400).json({
        message: "All booking fields are required"
      });
    }

    const start = new Date(startTime);
    const end = new Date(expectedEndTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({
        message: "End time must be after start time"
      });
    }
    if (start.getTime() <= Date.now()) {
      return res.status(400).json({ message: "Reservation start time must be in the future" });
    }
    const reservedMinutes = (end.getTime() - start.getTime()) / 60000;
    if (reservedMinutes < 30 || reservedMinutes > 120) {
      return res.status(400).json({ message: "Bookings must be at least 30 minutes and no longer than 2 hours" });
    }
    const arrivalGraceMinutes = calculateArrivalGraceMinutes(reservedMinutes);
    // Check vehicle
    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      ownerId: req.user.userId
    });

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found"
      });
    }

    const reservationFee = await calculateReservationFee(vehicle.vehicleType, start, end);

    // Check parking lot
    const parkingLot = await ParkingLot.findById(parkingLotId);

    if (!parkingLot || parkingLot.status !== "ACTIVE") {
      return res.status(404).json({
        message: "Parking lot not available"
      });
    }

    // Find compatible available slots
    const slots = await ParkingSlot.find({
      lotId: parkingLotId,
      vehicleType: vehicle.vehicleType,
      status: "AVAILABLE"
    }).sort({
      priority: 1,
      distanceFromEntry: 1
    });

    if (slots.length === 0) {
      return res.status(409).json({
        message: "No suitable parking slot available"
      });
    }

    let selectedSlot = null;

    // Check reservation conflicts
    for (const slot of slots) {
      const conflict = await Booking.findOne({
        parkingSlotId: slot._id,
        status: {
          $in: ["CONFIRMED", "ACTIVE"]
        },
        startTime: {
          $lt: end
        },
        expectedEndTime: {
          $gt: start
        }
      });

      if (!conflict) {
        // Claim the slot only if it is still free; another request may have
        // selected it while this request was checking reservation conflicts.
        const claimedSlot = await ParkingSlot.findOneAndUpdate(
          { _id: slot._id, status: "AVAILABLE" },
          { $set: { status: "RESERVED" } },
          { new: true }
        );
        if (!claimedSlot) continue;
        selectedSlot = claimedSlot;
        break;
      }
    }

    if (!selectedSlot) {
      return res.status(409).json({
        message: "No parking slot available for the selected time"
      });
    }

    const bookingId = `PKT-${Date.now()}`;

    let booking;
    try {
      booking = await Booking.create({
        bookingId,
        userId: req.user.userId,
        vehicleId,
        parkingLotId,
        parkingSlotId: selectedSlot._id,
        bookingType: "ONLINE",
        startTime: start,
        expectedEndTime: end,
        arrivalDeadline: new Date(start.getTime() + arrivalGraceMinutes * 60 * 1000),
        arrivalGraceMinutes,
        reservationAmount: reservationFee.baseAmount,
        reservationPaymentStatus: "DEMO_PAID",
        reservationPaymentReference: `DEMO-${bookingId}`,
        pricingSnapshot: {
          baseRate: reservationFee.baseRate,
          ratePerHour: reservationFee.ratePerHour,
          extraRatePerHour: reservationFee.extraRatePerHour,
          exitGracePeriodMinutes: reservationFee.exitGracePeriodMinutes,
          reservedMinutes: reservationFee.reservedMinutes,
          billedHours: reservationFee.billedHours
        },
        baseAmount: reservationFee.baseAmount,
        totalAmount: reservationFee.baseAmount,
        status: "CONFIRMED"
      });
    } catch (error) {
      await ParkingSlot.updateOne(
        { _id: selectedSlot._id, status: "RESERVED" },
        { $set: { status: "AVAILABLE" } }
      );
      throw error;
    }

    // Update available count
    await ParkingLot.updateOne(
      { _id: parkingLotId, availableSlots: { $gt: 0 } },
      { $inc: { availableSlots: -1 } }
    );
    notifyParkingChange(parkingLotId, "SLOT_RESERVED");

    res.status(201).json({
      message: "Parking booked successfully",
      booking: {
        bookingId: booking.bookingId,
        status: booking.status,
        parkingSlotId: booking.parkingSlotId,
        reservationAmount: booking.reservationAmount,
        reservationPaymentStatus: booking.reservationPaymentStatus,
        arrivalGraceMinutes: booking.arrivalGraceMinutes,
        arrivalDeadline: booking.arrivalDeadline,
        pricingSnapshot: booking.pricingSnapshot
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Booking failed",
      error: error.message
    });
  }
};

const getMyBookings = async (req, res) => {
  try {
    await expireMissedReservations();
    const bookings = await Booking.find({
      userId: req.user.userId
    })
      .populate("vehicleId")
      .populate("parkingLotId")
      .populate("parkingSlotId")
      .sort({ createdAt: -1 });

    res.json({
      bookings
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch bookings",
      error: error.message
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    await expireMissedReservations();
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.userId
    })
      .populate("vehicleId")
      .populate("parkingLotId")
      .populate("parkingSlotId");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    res.json({
      booking
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch booking",
      error: error.message
    });
  }
};

const cancelBooking = async (req, res) => {
  try {
    await expireMissedReservations();
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        message: "Only confirmed bookings can be cancelled"
      });
    }

    const cancelled = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "CONFIRMED" },
      { $set: {
        status: "CANCELLED",
        cancellationReason: "CUSTOMER",
        reservationPaymentStatus: booking.reservationPaymentStatus === "DEMO_PAID" ? "DEMO_REFUNDED" : booking.reservationPaymentStatus
      } },
      { new: true }
    );
    if (!cancelled) {
      return res.status(409).json({ message: "Booking status changed; refresh and try again" });
    }

    const releasedSlot = await ParkingSlot.findOneAndUpdate(
      { _id: booking.parkingSlotId, status: "RESERVED" },
      { $set: { status: "AVAILABLE" } }
    );

    if (releasedSlot) {
      await ParkingLot.updateOne(
        { _id: booking.parkingLotId },
        { $inc: { availableSlots: 1 } }
      );
    }
    notifyParkingChange(booking.parkingLotId, "BOOKING_CANCELLED");

    res.json({
      message: "Booking cancelled successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to cancel booking",
      error: error.message
    });
  }
};

const extendActiveBooking = async (req, res) => {
  try {
    await expireMissedReservations();
    const extensionMinutes = Number(req.body.extensionMinutes);
    if (![30, 60, 90, 120].includes(extensionMinutes)) {
      return res.status(400).json({ message: "Choose an extension of 30, 60, 90, or 120 minutes" });
    }

    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "ACTIVE") return res.status(400).json({ message: "Only an active parking session can be extended" });

    const oldEnd = new Date(booking.expectedEndTime);
    const newEnd = new Date(oldEnd.getTime() + extensionMinutes * 60 * 1000);
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      parkingSlotId: booking.parkingSlotId,
      status: { $in: ["CONFIRMED", "ACTIVE"] },
      startTime: { $lt: newEnd },
      expectedEndTime: { $gt: oldEnd }
    }).select("bookingId startTime expectedEndTime");
    if (conflict) {
      return res.status(409).json({
        message: `This slot is reserved again at ${conflict.startTime.toLocaleString()}; that extension is unavailable`,
        nextReservationStart: conflict.startTime
      });
    }

    const vehicle = await Vehicle.findById(booking.vehicleId);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
    const quote = await calculateReservationFee(vehicle.vehicleType, booking.startTime, newEnd, booking.pricingSnapshot);
    const previousReservationAmount = Number(booking.reservationAmount || 0);
    const additionalAmount = Math.max(0, quote.baseAmount - previousReservationAmount);
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "ACTIVE", expectedEndTime: oldEnd },
      {
        $set: {
          expectedEndTime: newEnd,
          reservationAmount: quote.baseAmount,
          reservationPaymentStatus: "DEMO_PAID",
          reservationPaymentReference: `${booking.reservationPaymentReference || `DEMO-${booking.bookingId}`}-EXT-${Date.now()}`,
          baseAmount: quote.baseAmount,
          totalAmount: quote.baseAmount,
          pricingSnapshot: {
            baseRate: quote.baseRate,
            ratePerHour: quote.ratePerHour,
            extraRatePerHour: quote.extraRatePerHour,
            exitGracePeriodMinutes: quote.exitGracePeriodMinutes,
            reservedMinutes: quote.reservedMinutes,
            billedHours: quote.billedHours
          }
        },
        $push: { extensions: { minutes: extensionMinutes, fromTime: oldEnd, toTime: newEnd, additionalAmount, paymentStatus: "DEMO_PAID" } }
      },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: "Booking changed while extending; refresh and try again" });

    await ParkingSession.updateOne(
      { bookingId: booking._id, status: "ACTIVE" },
      { $set: { expectedEndTime: newEnd, baseAmount: quote.baseAmount } }
    );
    notifyParkingChange(booking.parkingLotId, "BOOKING_EXTENDED");

    return res.json({
      message: "Parking time extended",
      booking: updated,
      extension: { minutes: extensionMinutes, additionalAmount, paymentStatus: "DEMO_PAID", previousReservationAmount, newReservationAmount: quote.baseAmount }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to extend parking session", error: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  extendActiveBooking
};
