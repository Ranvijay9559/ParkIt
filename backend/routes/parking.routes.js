const express = require("express");

const {
  createParkingLot,
  getParkingLots,
  createParkingSlot,
  getParkingSlots,
  getAvailability
} = require("../controllers/parking.controller");

const protect = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

const router = express.Router();

router.post("/lots", protect, admin, createParkingLot);
router.post("/slots", protect, admin, createParkingSlot);

router.get("/lots", getParkingLots);

router.get("/lots/:lotId/slots", getParkingSlots);

router.get("/lots/:lotId/availability", getAvailability);

module.exports = router;