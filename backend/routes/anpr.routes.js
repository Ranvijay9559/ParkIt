const express = require("express");

const {
  scanVehicle
} = require("../controllers/anpr.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/scan", protect, scanVehicle);

module.exports = router;