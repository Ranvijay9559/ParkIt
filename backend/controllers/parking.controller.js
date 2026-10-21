const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const Booking = require("../models/Booking");
const ParkingSession = require("../models/ParkingSession");
const { notifyParkingChange } = require("../services/realtime.service");
const { expireMissedReservations } = require("../services/reservation-expiry.service");

const createParkingLot = async (req, res) => {
  try {
    const { name, location, totalSlots } = req.body;

    if (!name || !location || !Number.isInteger(Number(totalSlots)) || Number(totalSlots) < 1) {
      return res.status(400).json({
        message: "Name, location and a positive whole number of total slots are required"
      });
    }

    const parkingLot = await ParkingLot.create({
      name,
      location,
      totalSlots,
      availableSlots: 0
    });

    res.status(201).json({
      message: "Parking lot created successfully",
      parkingLot
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create parking lot",
      error: error.message
    });
  }
};

const getParkingLots = async (req, res) => {
  try {
    await expireMissedReservations();
    const parkingLots = await ParkingLot.find().lean();
    const lotsWithAvailability = await Promise.all(parkingLots.map(async (lot) => {
      const [totalSlots, availableSlots, reservedSlots, occupiedSlots, maintenanceSlots] = await Promise.all([
        ParkingSlot.countDocuments({ lotId: lot._id, status: { $ne: "DECOMMISSIONED" } }),
        ParkingSlot.countDocuments({ lotId: lot._id, status: "AVAILABLE" }),
        ParkingSlot.countDocuments({ lotId: lot._id, status: "RESERVED" }),
        ParkingSlot.countDocuments({ lotId: lot._id, status: "OCCUPIED" }),
        ParkingSlot.countDocuments({ lotId: lot._id, status: "MAINTENANCE" })
      ]);
      return { ...lot, configuredCapacity: lot.totalSlots, totalSlots, availableSlots, reservedSlots, occupiedSlots, maintenanceSlots };
    }));

    res.json({
      parkingLots: lotsWithAvailability
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch parking lots",
      error: error.message
    });
  }
};

const createParkingSlot = async (req, res) => {
  try {
    const {
      lotId,
      slotNumber,
      floor,
      vehicleType,
      distanceFromEntry,
      priority
    } = req.body;

    const parkingLot = await ParkingLot.findById(lotId);

    if (!parkingLot) {
      return res.status(404).json({
        message: "Parking lot not found"
      });
    }

    const slotCount = await ParkingSlot.countDocuments({ lotId, status: { $ne: "DECOMMISSIONED" } });
    if (slotCount >= parkingLot.totalSlots) {
      return res.status(409).json({
        message: "This parking lot has reached its configured capacity"
      });
    }

    const existingSlot = await ParkingSlot.findOne({
      lotId,
      slotNumber
    });

    if (existingSlot) {
      return res.status(400).json({
        message: "Slot already exists"
      });
    }

    const slot = await ParkingSlot.create({
      lotId,
      slotNumber,
      floor,
      vehicleType,
      distanceFromEntry,
      priority
    });

    await ParkingLot.updateOne(
      { _id: lotId },
      { $inc: { availableSlots: 1 } }
    );
    notifyParkingChange(lotId, "SLOT_RELEASED");

    res.status(201).json({
      message: "Parking slot created successfully",
      slot
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create parking slot",
      error: error.message
    });
  }
};

const getParkingSlots = async (req, res) => {
  try {
    const slots = await ParkingSlot.find({
      lotId: req.params.lotId,
      status: { $ne: "DECOMMISSIONED" }
    });

    res.json({
      slots
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch parking slots",
      error: error.message
    });
  }
};

const getManageParkingSlots = async (req, res) => {
  try {
    const slots = await ParkingSlot.find({ lotId: req.params.lotId }).sort({ floor: 1, slotNumber: 1 });
    return res.json({ slots });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch managed parking slots", error: error.message });
  }
};

const decommissionParkingSlot = async (req, res) => {
  try {
    await expireMissedReservations();
    const slot = await ParkingSlot.findById(req.params.slotId);
    if (!slot) return res.status(404).json({ message: "Parking slot not found" });
    if (slot.status === "DECOMMISSIONED") return res.status(409).json({ message: "This parking slot has already been removed" });
    if (!["AVAILABLE", "MAINTENANCE"].includes(slot.status)) {
      return res.status(409).json({ message: "Reserved or occupied slots cannot be removed. Cancel the reservation or check out the vehicle first." });
    }

    const [activeBooking, activeSession] = await Promise.all([
      Booking.exists({ parkingSlotId: slot._id, status: { $in: ["CONFIRMED", "ACTIVE"] } }),
      ParkingSession.exists({ parkingSlotId: slot._id, status: "ACTIVE" })
    ]);
    if (activeBooking || activeSession) {
      return res.status(409).json({ message: "This slot still has an active reservation or parking session and cannot be removed." });
    }

    const previousStatus = slot.status;
    const removed = await ParkingSlot.findOneAndUpdate(
      { _id: slot._id, status: previousStatus },
      { $set: { status: "DECOMMISSIONED", decommissionedAt: new Date(), decommissionedBy: req.user.userId } },
      { new: true }
    );
    if (!removed) return res.status(409).json({ message: "Slot status changed; refresh and try again." });

    if (previousStatus === "AVAILABLE") {
      const counterUpdate = await ParkingLot.updateOne(
        { _id: slot.lotId, availableSlots: { $gt: 0 } },
        { $inc: { availableSlots: -1 } }
      );
      if (!counterUpdate.modifiedCount) {
        await ParkingSlot.updateOne(
          { _id: slot._id, status: "DECOMMISSIONED" },
          { $set: { status: "AVAILABLE" }, $unset: { decommissionedAt: 1, decommissionedBy: 1 } }
        );
        return res.status(409).json({ message: "Parking availability is out of sync. Refresh the lot and try again." });
      }
    }

    notifyParkingChange(slot.lotId, "SLOT_DECOMMISSIONED");
    return res.json({ message: `Slot ${slot.slotNumber} removed from service`, slot: removed });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove parking slot", error: error.message });
  }
};

const getAvailability = async (req, res) => {
  try {
    await expireMissedReservations();
    const lotId = req.params.lotId;

    const total = await ParkingSlot.countDocuments({ lotId, status: { $ne: "DECOMMISSIONED" } });

    const available = await ParkingSlot.countDocuments({
      lotId,
      status: "AVAILABLE"
    });

    const reserved = await ParkingSlot.countDocuments({
      lotId,
      status: "RESERVED"
    });

    const occupied = await ParkingSlot.countDocuments({
      lotId,
      status: "OCCUPIED"
    });

    const maintenance = await ParkingSlot.countDocuments({
      lotId,
      status: "MAINTENANCE"
    });

    res.json({
      total,
      available,
      reserved,
      occupied,
      maintenance
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch availability",
      error: error.message
    });
  }
};

module.exports = {
  createParkingLot,
  getParkingLots,
  createParkingSlot,
  getParkingSlots,
  getManageParkingSlots,
  decommissionParkingSlot,
  getAvailability
};
