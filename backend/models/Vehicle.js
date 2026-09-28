const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    vehicleType: {
      type: String,
      enum: ["CAR", "BIKE", "SUV", "TRUCK", "OTHER"],
      required: true
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    registeredBy: {
      type: String,
      enum: ["CUSTOMER", "ADMIN", "ANPR"],
      default: "CUSTOMER"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);