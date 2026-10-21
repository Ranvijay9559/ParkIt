const express = require("express");

const {
  createParkingLot,
  getParkingLots,
  createParkingSlot,
  getParkingSlots,
  getManageParkingSlots,
  decommissionParkingSlot,
  getAvailability
} = require("../controllers/parking.controller");

const protect = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const { generateDemoLot, simulateOccupancy } = require("../controllers/simulation.controller");

const router = express.Router();

router.post("/lots", protect, admin, createParkingLot);
router.post("/slots", protect, admin, createParkingSlot);
router.delete("/slots/:slotId", protect, admin, decommissionParkingSlot);
router.get("/lots/:lotId/manage-slots", protect, admin, getManageParkingSlots);
router.post("/demo-lots", protect, admin, generateDemoLot);
router.post("/lots/:lotId/simulate", protect, admin, simulateOccupancy);

router.get("/lots", getParkingLots);

router.get("/lots/:lotId/slots", getParkingSlots);

router.get("/lots/:lotId/availability", getAvailability);

module.exports = router;
