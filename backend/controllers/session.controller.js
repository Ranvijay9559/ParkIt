const Booking = require("../models/Booking");
const ParkingSession = require("../models/ParkingSession");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLot = require("../models/ParkingLot");
const Vehicle = require("../models/Vehicle");
const { notifyParkingChange } = require("../services/realtime.service");
const { expireMissedReservations } = require("../services/reservation-expiry.service");
const { calculateReservationFee } = require("../services/fee.service");


// Vehicle entry
const createParkingSession = async (req, res) => {
  try {
    await expireMissedReservations();
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        message: "bookingId is required"
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    // Make sure booking belongs to logged-in user
    if (req.user.role !== "ADMIN" && booking.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to use this booking"
      });
    }

    // Only confirmed bookings can enter
    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        message: "Only confirmed bookings can create a parking session"
      });
    }

    const earliestEntryTime = new Date(booking.startTime).getTime() - 15 * 60 * 1000;
    if (booking.bookingType !== "MANUAL" && Date.now() < earliestEntryTime) {
      return res.status(400).json({ message: `Entry is available from ${new Date(earliestEntryTime).toLocaleString()}` });
    }

    const activeVehicleSession = await ParkingSession.findOne({ vehicleId: booking.vehicleId, status: "ACTIVE" });
    if (activeVehicleSession) {
      return res.status(409).json({ message: "This vehicle already has an active parking session" });
    }

    const entryTime = new Date();
    const activatedBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "CONFIRMED" },
      { $set: { status: "ACTIVE", actualEntryTime: entryTime } },
      { new: true }
    );
    if (!activatedBooking) {
      return res.status(409).json({ message: "Booking has already been used or changed" });
    }

    const occupiedSlot = await ParkingSlot.findOneAndUpdate(
      { _id: booking.parkingSlotId, status: "RESERVED" },
      { $set: { status: "OCCUPIED" } },
      { new: true }
    );
    if (!occupiedSlot) {
      await Booking.updateOne(
        { _id: booking._id, status: "ACTIVE" },
        { $set: { status: "CONFIRMED" }, $unset: { actualEntryTime: 1 } }
      );
      return res.status(409).json({ message: "Reserved slot is no longer available" });
    }

    let session;
    try {
      session = await ParkingSession.create({
        bookingId: booking._id,
        userId: booking.userId,
        vehicleId: booking.vehicleId,
        parkingLotId: booking.parkingLotId,
        parkingSlotId: booking.parkingSlotId,
        entryTime,
        expectedEndTime: booking.expectedEndTime,
        baseAmount: booking.reservationAmount || 0,
        status: "ACTIVE"
      });
    } catch (error) {
      await ParkingSlot.updateOne(
        { _id: booking.parkingSlotId, status: "OCCUPIED" },
        { $set: { status: "RESERVED" } }
      );
      await Booking.updateOne(
        { _id: booking._id, status: "ACTIVE" },
        { $set: { status: "CONFIRMED" }, $unset: { actualEntryTime: 1 } }
      );
      throw error;
    }
    notifyParkingChange(booking.parkingLotId, "SLOT_OCCUPIED");

    res.status(201).json({
      message: "Vehicle entry recorded successfully",
      session
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to create parking session",
      error: error.message
    });
  }
};

const findEntryBookingsByPlate = async (req, res) => {
  try {
    await expireMissedReservations();
    const Vehicle = require("../models/Vehicle");
    const plate = String(req.body.vehicleNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!plate) return res.status(400).json({ message: "vehicleNumber is required" });
    const vehicle = await Vehicle.findOne({ vehicleNumber: plate });
    if (!vehicle) return res.status(404).json({ message: `No registered vehicle found for ${plate}` });
    const bookings = await Booking.find({ vehicleId: vehicle._id, status: "CONFIRMED" })
      .populate("parkingLotId", "name location")
      .populate("parkingSlotId", "slotNumber floor")
      .sort({ startTime: 1 });
    if (!bookings.length) return res.status(404).json({ message: `No confirmed booking found for ${plate}` });
    return res.json({ vehicle: { id: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleType: vehicle.vehicleType }, bookings });
  } catch (error) {
    return res.status(500).json({ message: "Failed to find booking for plate", error: error.message });
  }
};

const getActiveSessionsForAdmin = async (req, res) => {
  try {
    const sessions = await ParkingSession.find({ status: "ACTIVE" })
      .populate("vehicleId", "vehicleNumber vehicleType")
      .populate("parkingLotId", "name location")
      .populate("parkingSlotId", "slotNumber floor")
      .sort({ entryTime: 1 });
    return res.json({ sessions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load active sessions", error: error.message });
  }
};

const createAdminWalkInEntry = async (req, res) => {
  let claimedSlotId;
  let createdBookingId;
  let createdSessionId;
  let lotCounterDecremented = false;
  try {
    await expireMissedReservations();
    const vehicleNumber = String(req.body.vehicleNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const vehicleType = String(req.body.vehicleType || "").toUpperCase();
    const { parkingLotId, parkingSlotId } = req.body;
    const durationMinutes = Number(req.body.durationMinutes || 60);
    const validTypes = ["CAR", "BIKE", "SUV", "TRUCK", "OTHER"];
    if (!/^[A-Z0-9]{4,12}$/.test(vehicleNumber)) return res.status(400).json({ message: "Enter a valid vehicle number plate" });
    if (!validTypes.includes(vehicleType)) return res.status(400).json({ message: "Choose a valid vehicle type" });
    if (![30, 60, 90, 120].includes(durationMinutes)) return res.status(400).json({ message: "Choose an initial parking period of 30, 60, 90, or 120 minutes" });
    if (!parkingLotId || !parkingSlotId) return res.status(400).json({ message: "Choose a parking lot and an available slot" });

    const lot = await ParkingLot.findOne({ _id: parkingLotId, status: "ACTIVE" });
    if (!lot) return res.status(404).json({ message: "Active parking lot not found" });
    const slot = await ParkingSlot.findOne({ _id: parkingSlotId, lotId: lot._id, vehicleType, status: "AVAILABLE" });
    if (!slot) return res.status(409).json({ message: "That slot is no longer available for this vehicle type. Refresh the slots and try again." });

    let vehicle = await Vehicle.findOne({ vehicleNumber });
    if (vehicle && vehicle.vehicleType !== vehicleType) {
      return res.status(409).json({ message: `This plate is already registered as ${vehicle.vehicleType}. Select that vehicle type.` });
    }
    if (!vehicle) {
      try {
        vehicle = await Vehicle.create({ vehicleNumber, vehicleType, ownerId: req.user.userId, registeredBy: "ADMIN" });
      } catch (error) {
        if (error.code !== 11000) throw error;
        vehicle = await Vehicle.findOne({ vehicleNumber });
        if (!vehicle || vehicle.vehicleType !== vehicleType) return res.status(409).json({ message: "This plate was registered at the same time with a different vehicle type. Refresh and try again." });
      }
    }

    if (await ParkingSession.exists({ vehicleId: vehicle._id, status: "ACTIVE" })) {
      return res.status(409).json({ message: "This vehicle already has an active parking session" });
    }

    const entryTime = new Date();
    const expectedEndTime = new Date(entryTime.getTime() + durationMinutes * 60 * 1000);
    const overlappingReservation = await Booking.findOne({
      vehicleId: vehicle._id,
      status: "CONFIRMED",
      startTime: { $lt: expectedEndTime },
      expectedEndTime: { $gt: entryTime }
    }).select("bookingId");
    if (overlappingReservation) {
      return res.status(409).json({ message: `This vehicle has confirmed reservation ${overlappingReservation.bookingId}. Use reserved booking entry instead.` });
    }
    const quote = await calculateReservationFee(vehicleType, entryTime, expectedEndTime);
    const claimedSlot = await ParkingSlot.findOneAndUpdate(
      { _id: slot._id, status: "AVAILABLE" },
      { $set: { status: "OCCUPIED" } },
      { new: true }
    );
    if (!claimedSlot) return res.status(409).json({ message: "That slot was just taken. Refresh the slots and choose another." });
    claimedSlotId = claimedSlot._id;
    const counterUpdate = await ParkingLot.updateOne(
      { _id: lot._id, availableSlots: { $gt: 0 } },
      { $inc: { availableSlots: -1 } }
    );
    if (!counterUpdate.modifiedCount) {
      await ParkingSlot.updateOne({ _id: claimedSlotId, status: "OCCUPIED" }, { $set: { status: "AVAILABLE" } });
      claimedSlotId = null;
      return res.status(409).json({ message: "Parking availability changed. Refresh the lot and try again." });
    }
    lotCounterDecremented = true;

    const booking = await Booking.create({
      bookingId: `MAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: req.user.userId,
      vehicleId: vehicle._id,
      parkingLotId: lot._id,
      parkingSlotId: claimedSlot._id,
      bookingType: "MANUAL",
      startTime: entryTime,
      expectedEndTime,
      actualEntryTime: entryTime,
      reservationAmount: 0,
      reservationPaymentStatus: "UNPAID",
      pricingSnapshot: {
        baseRate: quote.baseRate,
        ratePerHour: quote.ratePerHour,
        extraRatePerHour: quote.extraRatePerHour,
        exitGracePeriodMinutes: quote.exitGracePeriodMinutes,
        reservedMinutes: quote.reservedMinutes,
        billedHours: quote.billedHours
      },
      status: "ACTIVE"
    });
    createdBookingId = booking._id;

    const session = await ParkingSession.create({
      bookingId: booking._id,
      userId: req.user.userId,
      vehicleId: vehicle._id,
      parkingLotId: lot._id,
      parkingSlotId: claimedSlot._id,
      entryTime,
      expectedEndTime,
      baseAmount: 0,
      status: "ACTIVE"
    });
    createdSessionId = session._id;

    notifyParkingChange(lot._id, "SLOT_OCCUPIED");
    return res.status(201).json({ message: "Walk-in entry recorded; demo charge is calculated at exit", booking, session, vehicle });
  } catch (error) {
    if (createdSessionId) await ParkingSession.deleteOne({ _id: createdSessionId });
    if (createdBookingId) await Booking.deleteOne({ _id: createdBookingId });
    if (claimedSlotId) {
      await ParkingSlot.updateOne({ _id: claimedSlotId, status: "OCCUPIED" }, { $set: { status: "AVAILABLE" } });
      if (lotCounterDecremented) await ParkingLot.updateOne({ _id: req.body.parkingLotId }, { $inc: { availableSlots: 1 } });
    }
    return res.status(500).json({ message: "Failed to record walk-in entry", error: error.message });
  }
};

// Vehicle exit
const completeParkingSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        message: "sessionId is required"
      });
    }

    // Find active session
    let session = await ParkingSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        message: "Parking session not found"
      });
    }

    // Make sure session belongs to logged-in user
    if (req.user.role !== "ADMIN" && session.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to complete this session"
      });
    }

    // Session must be active
    if (session.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Parking session is already completed"
      });
    }

    // Get vehicle
    const Vehicle = require("../models/Vehicle");

    const vehicle = await Vehicle.findById(
      session.vehicleId
    );

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found"
      });
    }

    // Exit time
    const exitTime = new Date();

    const booking = await Booking.findById(session.bookingId);
    const { calculateExitFee } = require("../services/fee.service");
    const reservedAmount = booking?.reservationPaymentStatus === "DEMO_PAID"
      ? booking.reservationAmount
      : undefined;
    const fee = await calculateExitFee(
      vehicle.vehicleType,
      reservedAmount,
      booking?.startTime || session.entryTime,
      booking?.expectedEndTime || session.expectedEndTime,
      exitTime,
      session.entryTime,
      booking?.pricingSnapshot
    );

    // Update session
    const completedSession = await ParkingSession.findOneAndUpdate(
      { _id: session._id, status: "ACTIVE" },
      {
        $set: {
          exitTime,
          status: "COMPLETED",
          baseAmount: fee.baseAmount,
          extraAmount: fee.extraAmount,
          totalAmount: fee.totalAmount
        }
      },
      { new: true }
    );
    if (!completedSession) {
      return res.status(409).json({ message: "Session has already been completed" });
    }
    session = completedSession;

    if (booking) {
      booking.status = "COMPLETED";
      booking.actualExitTime = exitTime;
      booking.baseAmount = fee.baseAmount;
      booking.extraAmount = fee.extraAmount;
      booking.totalAmount = fee.totalAmount;
      booking.exitPaymentStatus = fee.extraAmount > 0 ? "DEMO_PAID" : "NOT_DUE";
      if (booking.bookingType === "MANUAL" && fee.totalAmount > 0) booking.exitPaymentStatus = "DEMO_PAID";
      booking.exitPricingBreakdown = {
        minutesLate: fee.minutesLate,
        exitGracePeriodMinutes: fee.exitGracePeriodMinutes,
        chargeableMinutes: fee.chargeableMinutes,
        extraHours: fee.extraHours,
        extraRatePerHour: fee.extraRatePerHour
      };

      await booking.save();
    }

    // Release parking slot
    const releasedSlot = await ParkingSlot.findOneAndUpdate(
      { _id: session.parkingSlotId, status: "OCCUPIED" },
      { $set: { status: "AVAILABLE" } }
    );
    if (releasedSlot) {
      await ParkingLot.updateOne(
        { _id: session.parkingLotId },
        { $inc: { availableSlots: 1 } }
      );
    }
    notifyParkingChange(session.parkingLotId, "SLOT_RELEASED");

    res.json({
      message: "Vehicle exit recorded successfully",

      session: {
        id: session._id,
        entryTime: session.entryTime,
        exitTime: session.exitTime,
        status: session.status,
        baseAmount: session.baseAmount,
        extraAmount: session.extraAmount,
        totalAmount: session.totalAmount
      }
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to complete parking session",
      error: error.message
    });
  }
};

// Admin ANPR exit: the OCR result is matched against the registered plate,
// then the normal checkout path records fees and releases the slot.
const completeParkingSessionByPlate = async (req, res) => {
  try {
    const Vehicle = require("../models/Vehicle");
    const plate = String(req.body.vehicleNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!plate) return res.status(400).json({ message: "vehicleNumber is required" });

    const vehicle = await Vehicle.findOne({ vehicleNumber: plate });
    if (!vehicle) return res.status(404).json({ message: `No registered vehicle found for ${plate}` });
    const session = await ParkingSession.findOne({ vehicleId: vehicle._id, status: "ACTIVE" });
    if (!session) return res.status(404).json({ message: `No active parking session found for ${plate}` });

    req.body.sessionId = session._id.toString();
    return completeParkingSession(req, res);
  } catch (error) {
    return res.status(500).json({ message: "Failed to find active session for plate", error: error.message });
  }
};


module.exports = {
  createParkingSession,
  completeParkingSession,
  completeParkingSessionByPlate,
  findEntryBookingsByPlate,
  getActiveSessionsForAdmin,
  createAdminWalkInEntry
};
