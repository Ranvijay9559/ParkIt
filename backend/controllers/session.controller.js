const Booking = require("../models/Booking");
const ParkingSession = require("../models/ParkingSession");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLot = require("../models/ParkingLot");
const { notifyParkingChange } = require("../services/realtime.service");


// Vehicle entry
const createParkingSession = async (req, res) => {
  try {
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

    // Calculate fee
    const {
      calculateParkingFee
    } = require("../services/fee.service");

    const fee = await calculateParkingFee(
      vehicle.vehicleType,
      session.entryTime,
      session.expectedEndTime,
      exitTime
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

    // Update booking
    const Booking = require("../models/Booking");

    const booking = await Booking.findById(
      session.bookingId
    );

    if (booking) {
      booking.status = "COMPLETED";
      booking.actualExitTime = exitTime;
      booking.baseAmount = fee.baseAmount;
      booking.extraAmount = fee.extraAmount;
      booking.totalAmount = fee.totalAmount;

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


module.exports = {
  createParkingSession,
  completeParkingSession
};
