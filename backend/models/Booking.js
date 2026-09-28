const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
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

    bookingType: {
      type: String,
      enum: ["ONLINE", "MANUAL"],
      default: "ONLINE"
    },

    startTime: {
      type: Date,
      required: true
    },

    expectedEndTime: {
      type: Date,
      required: true
    },

    actualEntryTime: {
      type: Date
    },

    actualExitTime: {
      type: Date
    },

    status: {
      type: String,
      enum: [
        "CONFIRMED",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "CONFIRMED"
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
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Booking", bookingSchema);