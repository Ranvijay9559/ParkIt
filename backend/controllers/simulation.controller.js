const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingSession = require("../models/ParkingSession");
const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const { notifyParkingChange } = require("../services/realtime.service");

const generateDemoLot = async (req, res) => {
  try {
    const capacity = Math.min(60, Math.max(4, Number(req.body.capacity) || 12));
    const name = String(req.body.name || "ParkIt Demo Lot").trim();
    const lot = await ParkingLot.create({ name, location: "Demo environment", totalSlots: capacity, availableSlots: capacity });
    const types = ["CAR", "BIKE", "SUV"];
    await ParkingSlot.insertMany(Array.from({ length: capacity }, (_, i) => ({
      lotId: lot._id,
      slotNumber: `D-${String(i + 1).padStart(2, "0")}`,
      floor: 1 + Math.floor(i / 20),
      vehicleType: types[i % types.length],
      status: "AVAILABLE",
      distanceFromEntry: i * 2,
      priority: 1
    })));
    notifyParkingChange(lot._id, "DEMO_LOT_CREATED");
    return res.status(201).json({ message: "Demo lot generated", parkingLot: lot, slotsCreated: capacity });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate demo lot", error: error.message });
  }
};

const simulateOccupancy = async (req, res) => {
  try {
    const desired = Number(req.body.occupancyPercent);
    if (!Number.isFinite(desired) || desired < 0 || desired > 100) {
      return res.status(400).json({ message: "occupancyPercent must be between 0 and 100" });
    }
    const lot = await ParkingLot.findById(req.params.lotId);
    if (!lot) return res.status(404).json({ message: "Parking lot not found" });
    const slots = await ParkingSlot.find({ lotId: lot._id, status: { $ne: "DECOMMISSIONED" } }).sort({ slotNumber: 1 });
    const occupiedTarget = Math.round(slots.length * desired / 100);
    const simulated = await ParkingSession.find({ parkingLotId: lot._id, status: "ACTIVE", isSimulated: true }).sort({ entryTime: -1 });
    const realOccupancy = await ParkingSlot.countDocuments({ lotId: lot._id, status: "OCCUPIED" }) - simulated.length;
    const simulatedTarget = Math.max(0, occupiedTarget - Math.max(0, realOccupancy));
    const checkedOut = simulated.slice(simulatedTarget);

    for (const session of checkedOut) {
      const now = new Date();
      let fee = { baseAmount: 0, extraAmount: 0, totalAmount: 0 };
      try {
        const vehicle = await Vehicle.findById(session.vehicleId);
        fee = await require("../services/fee.service").calculateParkingFee(vehicle.vehicleType, session.entryTime, session.expectedEndTime, now);
      } catch (_) {
        // Keep the simulator usable before pricing rules have been configured.
      }
      await ParkingSession.updateOne({ _id: session._id, status: "ACTIVE" }, { $set: { status: "COMPLETED", exitTime: now, ...fee } });
      await Booking.updateOne({ _id: session.bookingId, status: "ACTIVE" }, { $set: { status: "COMPLETED", actualExitTime: now, ...fee } });
      const released = await ParkingSlot.findOneAndUpdate({ _id: session.parkingSlotId, status: "OCCUPIED" }, { $set: { status: "AVAILABLE" } });
      if (released) await ParkingLot.updateOne({ _id: lot._id }, { $inc: { availableSlots: 1 } });
    }

    const remainingSimulated = Math.min(simulated.length, simulatedTarget);
    const entriesNeeded = Math.max(0, simulatedTarget - remainingSimulated);
    const freeSlots = await ParkingSlot.find({ lotId: lot._id, status: "AVAILABLE" }).sort({ slotNumber: 1 }).limit(entriesNeeded);
    let entered = 0;
    for (const slot of freeSlots) {
      const now = new Date();
      const plate = `DEMO${Date.now().toString().slice(-7)}${entered}`;
      const vehicle = await Vehicle.create({ vehicleNumber: plate, vehicleType: slot.vehicleType, ownerId: req.user.userId, registeredBy: "ADMIN" });
      const booking = await Booking.create({
        bookingId: `DEMO-${Date.now()}-${entered}`, userId: req.user.userId, vehicleId: vehicle._id,
        parkingLotId: lot._id, parkingSlotId: slot._id, bookingType: "MANUAL", startTime: now,
        expectedEndTime: new Date(now.getTime() + 60 * 60 * 1000), actualEntryTime: now, status: "ACTIVE"
      });
      await ParkingSession.create({ bookingId: booking._id, userId: req.user.userId, vehicleId: vehicle._id,
        parkingLotId: lot._id, parkingSlotId: slot._id, entryTime: now, expectedEndTime: booking.expectedEndTime,
        status: "ACTIVE", isSimulated: true });
      const occupied = await ParkingSlot.findOneAndUpdate({ _id: slot._id, status: "AVAILABLE" }, { $set: { status: "OCCUPIED" } });
      if (occupied) {
        await ParkingLot.updateOne({ _id: lot._id, availableSlots: { $gt: 0 } }, { $inc: { availableSlots: -1 } });
        entered += 1;
      }
    }
    notifyParkingChange(lot._id, "SIMULATION_RECONCILED");
    return res.json({ message: "Demo occupancy reconciled", occupancyPercent: desired, simulatedEntries: entered, simulatedCheckouts: checkedOut.length,
      availability: { total: slots.length, occupied: await ParkingSlot.countDocuments({ lotId: lot._id, status: "OCCUPIED" }), available: await ParkingSlot.countDocuments({ lotId: lot._id, status: "AVAILABLE" }) } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to simulate occupancy", error: error.message });
  }
};

module.exports = { generateDemoLot, simulateOccupancy };
