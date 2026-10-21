const express = require("express");

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  extendActiveBooking
} = require("../controllers/booking.controller");

const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", protect, createBooking);
router.get("/", protect, getMyBookings);
router.get("/:id", protect, getBookingById);
router.patch("/:id/cancel", protect, cancelBooking);
router.patch("/:id/extend", protect, extendActiveBooking);

module.exports = router;
