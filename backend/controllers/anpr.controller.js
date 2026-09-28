const {
  detectVehicleNumber
} = require("../services/anpr.service");

const scanVehicle = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        message: "Vehicle image is required"
      });
    }

    const result = await detectVehicleNumber(image);

    if (!result.vehicleNumber) {
      return res.status(400).json({
        message: "Could not detect vehicle number",
        rawText: result.rawText
      });
    }

    res.json({
      message: "Vehicle number detected",
      vehicleNumber: result.vehicleNumber,
      rawText: result.rawText
    });
  } catch (error) {
    console.error("ANPR error:", error);

    res.status(500).json({
      message: "Vehicle number detection failed",
      error: error.message
    });
  }
};

module.exports = {
  scanVehicle
};