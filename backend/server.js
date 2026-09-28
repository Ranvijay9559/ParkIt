const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const parkingRoutes = require("./routes/parking.routes");
const bookingRoutes = require("./routes/booking.routes");
const pricingRoutes = require("./routes/pricing.routes");
const sessionRoutes = require("./routes/session.routes");
const anprRoutes = require("./routes/anpr.routes");
const { setSocketServer } = require("./services/realtime.service");

dotenv.config();

const app = express();

app.use(cors());
// The camera scan page submits a base64 JPEG, which is larger than Express's
// small default JSON body limit.
app.use(express.json({ limit: "5mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/anpr", anprRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "ParkIt Backend is running"
  });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH"]
  }
});
setSocketServer(io);

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`ParkIt backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("ParkIt backend failed to start:", error.message);
    process.exit(1);
  });
