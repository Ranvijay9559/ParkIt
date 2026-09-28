const express = require("express");

const {
  registerVehicle,
  getMyVehicles,
  getVehicleById
} = require("../controllers/vehicle.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", protect, registerVehicle);

router.get("/", protect, getMyVehicles);

router.get("/:id", protect, getVehicleById);

module.exports = router;