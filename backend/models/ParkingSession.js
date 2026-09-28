const mongoose = require("mongoose");

const parkingSessionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true
    },

    parkingSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSlot",
      required: true
    },

    entryTime: {
      type: Date,
      required: true
    },

    expectedEndTime: {
      type: Date,
      required: true
    },

    exitTime: {
      type: Date
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED"],
      default: "ACTIVE"
    },

    baseAmount: {
      type: Number,
      default: 0
    },

    extraAmount: {
      type: Number,
      default: 0
    },

    totalAmount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ParkingSession",
  parkingSessionSchema
);