const connectDB = require("../../config/db");
const { expireMissedReservations } = require("../../services/reservation-expiry.service");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await connectDB();
    const result = await expireMissedReservations();
    return res.status(200).json({ message: "Reservation expiry check completed", ...result });
  } catch (error) {
    console.error("Scheduled reservation expiry failed:", error.message);
    return res.status(500).json({ message: "Reservation expiry check failed" });
  }
};
