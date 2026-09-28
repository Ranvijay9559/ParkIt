const express = require("express");

const {
  createParkingSession,
  completeParkingSession
} = require("../controllers/session.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

// Vehicle entry
router.post("/entry", protect, createParkingSession);

// Vehicle exit
router.post("/exit", protect, completeParkingSession);

module.exports = router;