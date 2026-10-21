import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Parking from "./pages/Parking";
import Booking from "./pages/Booking";
import MyBookings from "./pages/MyBookings";
import AdminDashboard from "./pages/AdminDashboard";
import Vehicles from "./pages/Vehicles";
import VehicleScan from "./pages/VehicleScan";
import AdminParking from "./pages/AdminParking";
import AdminPricing from "./pages/AdminPricing";
import RoleRoute from "./components/RoleRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<RoleRoute roles={["CUSTOMER"]} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicle-scan" element={<VehicleScan />} />
        </Route>
        <Route element={<RoleRoute roles={["CUSTOMER", "ADMIN"]} />}>
          <Route path="/parking" element={<Parking />} />
        </Route>
        <Route element={<RoleRoute roles={["ADMIN"]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/parking" element={<AdminParking />} />
          <Route path="/admin/exit-scan" element={<VehicleScan />} />
          <Route path="/admin/entry-scan" element={<VehicleScan />} />
          <Route path="/admin/pricing" element={<AdminPricing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
