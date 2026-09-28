const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const { notifyParkingChange } = require("../services/realtime.service");

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
    const parkingLots = await ParkingLot.find().lean();
    const lotsWithAvailability = await Promise.all(parkingLots.map(async (lot) => {
      const [totalSlots, availableSlots] = await Promise.all([
        ParkingSlot.countDocuments({ lotId: lot._id }),
        ParkingSlot.countDocuments({ lotId: lot._id, status: "AVAILABLE" })
      ]);
      return { ...lot, configuredCapacity: lot.totalSlots, totalSlots, availableSlots };
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

    const slotCount = await ParkingSlot.countDocuments({ lotId });
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
      lotId: req.params.lotId
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

const getAvailability = async (req, res) => {
  try {
    const lotId = req.params.lotId;

    const total = await ParkingSlot.countDocuments({ lotId });

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
  getAvailability
};
