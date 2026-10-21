const express = require("express");

const {
  createParkingSession,
  completeParkingSession,
  completeParkingSessionByPlate,
  findEntryBookingsByPlate,
  getActiveSessionsForAdmin,
  createAdminWalkInEntry
} = require("../controllers/session.controller");

const protect = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

const router = express.Router();

// Vehicle entry
router.post("/entry", protect, admin, createParkingSession);
router.post("/admin/entry-matches", protect, admin, findEntryBookingsByPlate);
router.post("/admin/entry", protect, admin, createParkingSession);
router.post("/admin/walk-in-entry", protect, admin, createAdminWalkInEntry);
router.get("/admin/active", protect, admin, getActiveSessionsForAdmin);

// Vehicle exit
router.post("/exit", protect, completeParkingSession);
router.post("/admin/exit-by-plate", protect, admin, completeParkingSessionByPlate);

module.exports = router;
