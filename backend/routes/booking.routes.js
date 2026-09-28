const express = require("express");

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking
} = require("../controllers/booking.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", protect, createBooking);
router.get("/", protect, getMyBookings);
router.get("/:id", protect, getBookingById);
router.patch("/:id/cancel", protect, cancelBooking);

module.exports = router;
