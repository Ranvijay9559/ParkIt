const Vehicle = require("../models/Vehicle");

const registerVehicle = async (req, res) => {
  try {
    const { vehicleNumber, vehicleType } = req.body;

    if (!vehicleNumber || !vehicleType) {
      return res.status(400).json({
        message: "Vehicle number and vehicle type are required"
      });
    }

    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: vehicleNumber.toUpperCase()
    });

    if (existingVehicle) {
      return res.status(400).json({
        message: "Vehicle already registered"
      });
    }

    const vehicle = await Vehicle.create({
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleType,
      ownerId: req.user.userId,
      registeredBy: req.user.role
    });

    res.status(201).json({
      message: "Vehicle registered successfully",
      vehicle
    });
  } catch (error) {
    res.status(500).json({
      message: "Vehicle registration failed",
      error: error.message
    });
  }
};

const getMyVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      ownerId: req.user.userId
    });

    res.json({
      vehicles
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch vehicles",
      error: error.message
    });
  }
};

const getVehicleById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== "ADMIN") query.ownerId = req.user.userId;
    const vehicle = await Vehicle.findOne(query);

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found"
      });
    }

    res.json({
      vehicle
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch vehicle",
      error: error.message
    });
  }
};

module.exports = {
  registerVehicle,
  getMyVehicles,
  getVehicleById
};
