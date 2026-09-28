const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema(
  {
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true
    },

    slotNumber: {
      type: String,
      required: true
    },

    floor: {
      type: Number,
      default: 1
    },

    vehicleType: {
      type: String,
      enum: ["CAR", "BIKE", "SUV", "TRUCK", "OTHER"],
      required: true
    },

    status: {
      type: String,
      enum: ["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"],
      default: "AVAILABLE"
    },

    distanceFromEntry: {
      type: Number,
      default: 0
    },

    priority: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);