const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const { notifyParkingChange } = require("../services/realtime.service");

const createBooking = async (req, res) => {
  try {
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

    const bookingId =
      `PKT-${Date.now()}`;

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
        parkingSlotId: booking.parkingSlotId
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
      { $set: { status: "CANCELLED" } },
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

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking
};
