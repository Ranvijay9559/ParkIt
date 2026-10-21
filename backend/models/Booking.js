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

    arrivalDeadline: {
      type: Date
    },

    arrivalGraceMinutes: {
      type: Number,
      min: 0
    },

    cancellationReason: {
      type: String,
      enum: ["CUSTOMER", "NO_SHOW", "ADMIN"]
    },

    reservationAmount: {
      type: Number,
      min: 0,
      default: 0
    },

    reservationPaymentStatus: {
      type: String,
      enum: ["UNPAID", "DEMO_PAID", "DEMO_REFUNDED", "DEMO_FORFEITED"],
      default: "UNPAID"
    },

    reservationPaymentReference: {
      type: String
    },

    pricingSnapshot: {
      baseRate: Number,
      ratePerHour: Number,
      extraRatePerHour: Number,
      exitGracePeriodMinutes: Number,
      reservedMinutes: Number,
      billedHours: Number
    },

    exitPricingBreakdown: {
      minutesLate: Number,
      exitGracePeriodMinutes: Number,
      chargeableMinutes: Number,
      extraHours: Number,
      extraRatePerHour: Number
    },

    extensions: [{
      minutes: { type: Number, min: 30, max: 120 },
      fromTime: Date,
      toTime: Date,
      additionalAmount: { type: Number, min: 0 },
      paymentStatus: { type: String, enum: ["DEMO_PAID"], default: "DEMO_PAID" },
      createdAt: { type: Date, default: Date.now }
    }],

    exitPaymentStatus: {
      type: String,
      enum: ["NOT_DUE", "DEMO_PAID"],
      default: "NOT_DUE"
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

bookingSchema.index({ status: 1, arrivalDeadline: 1 });
bookingSchema.index({ status: 1, startTime: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
