import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      API.get("/auth/me"),
      API.get("/vehicles"),
      API.get("/bookings"),
      API.get("/parking/lots")
    ]).then(([userResponse, vehicleResponse, bookingResponse, parkingResponse]) => {
      if (!active) return;
      setUser(userResponse.data.user);
      setVehicles(vehicleResponse.data.vehicles || []);
      setBookings(bookingResponse.data.bookings || []);
      setParkingLots(parkingResponse.data.parkingLots || []);
    }).catch((error) => {
      console.error("Dashboard loading failed:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  const activeBooking = bookings.find(
    (booking) =>
      booking.status === "CONFIRMED" ||
      booking.status === "ACTIVE"
  );

  const totalAvailableSlots = parkingLots.reduce(
    (total, lot) => total + (lot.availableSlots || 0),
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-slate-600">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="h-16 flex items-center justify-between">

            <Link
              to="/dashboard"
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                P
              </div>

              <span className="text-xl font-bold text-slate-900">
                Park<span className="text-blue-600">It</span>
              </span>
            </Link>

            <div className="flex items-center gap-4">

              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900">
                  {user?.name}
                </p>

                <p className="text-xs text-slate-500">
                  Customer
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                Logout
              </button>

            </div>

          </div>

        </div>

      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome */}
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-800 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[36px] border-white/5" />
          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-teal-200">YOUR PARKIT OVERVIEW</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {user?.name}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">
                {totalAvailableSlots > 0
                  ? `${totalAvailableSlots} parking ${totalAvailableSlots === 1 ? "space is" : "spaces are"} currently available across ${parkingLots.length} ${parkingLots.length === 1 ? "location" : "locations"}.`
                  : "Check nearby locations and reserve a space before you set off."}
              </p>
            </div>
            <Link to="/booking" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50">
              Reserve parking <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* Available Slots */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  Available Slots
                </p>

                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {totalAvailableSlots}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xl">
                P
              </div>

            </div>

          </div>

          {/* Vehicles */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  My Vehicles
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {vehicles.length}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 text-xl">
                V
              </div>

            </div>

          </div>

          {/* Bookings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  Total Bookings
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {bookings.length}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 text-xl">
                B
              </div>

            </div>

          </div>

          {/* Active Booking */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  Active Booking
                </p>

                <p className="mt-2 text-3xl font-bold text-green-600">
                  {activeBooking ? "Yes" : "No"}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 text-xl">
                ✓
              </div>

            </div>

          </div>

        </div>

        {/* Quick Actions */}
        <section className="mt-8">

          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            <Link
              to="/parking"
              className="group bg-blue-600 rounded-2xl p-6 text-white hover:bg-blue-700 transition"
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                P
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                Find Parking
              </h3>

              <p className="mt-2 text-sm text-blue-100">
                Find available parking locations and slots.
              </p>

              <p className="mt-4 text-sm font-semibold">
                Find a slot →
              </p>
            </Link>

            <Link
              to="/booking"
              className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xl">
                +
              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                Book a Slot
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Reserve a parking slot for your vehicle.
              </p>

              <p className="mt-4 text-sm font-semibold text-blue-600">
                Create booking →
              </p>
            </Link>

            <Link
              to="/my-bookings"
              className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 text-xl">
                B
              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                My Bookings
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                View your current and previous bookings.
              </p>

              <p className="mt-4 text-sm font-semibold text-purple-600">
                View bookings →
              </p>
            </Link>

            <Link
              to="/vehicles"
              className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 text-xl">
                V
              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                My Vehicles
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Register and manage your vehicles.
              </p>

              <p className="mt-4 text-sm font-semibold text-green-600">
                Manage vehicles →
              </p>
            </Link>

          </div>

        </section>

        {/* Current Booking */}
        <section className="mt-8">

          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Current Booking
          </h2>

          {activeBooking ? (

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                <div>
                  <p className="text-sm text-slate-500">
                    Booking ID
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {activeBooking.bookingId}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Vehicle
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {activeBooking.vehicleId?.vehicleNumber ||
                      "Vehicle"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Parking Slot
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {activeBooking.parkingSlotId?.slotNumber ||
                      "Assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Status
                  </p>

                  <span className="inline-block mt-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                    {activeBooking.status}
                  </span>
                </div>

              </div>

            </div>

          ) : (

            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">

              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500 text-xl">
                P
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                No active booking
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                You currently don't have an active parking booking.
              </p>

              <Link
                to="/booking"
                className="inline-block mt-5 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Book a Parking Slot
              </Link>

            </div>

          )}

        </section>

        {/* Parking Locations */}
        <section className="mt-8">

          <div className="flex items-center justify-between mb-4">

            <h2 className="text-xl font-bold text-slate-900">
              Parking Locations
            </h2>

            <Link
              to="/parking"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all →
            </Link>

          </div>

          {parkingLots.length === 0 ? (

            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">

              <p className="text-slate-500">
                No parking locations available.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

              {parkingLots.slice(0, 3).map((lot) => (

                <div
                  key={lot._id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
                >

                  <div className="flex items-start justify-between">

                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {lot.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {lot.location}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        lot.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {lot.status}
                    </span>

                  </div>

                  <div className="mt-6 flex items-end justify-between">

                    <div>
                      <p className="text-xs text-slate-500">
                        Available slots
                      </p>

                      <p className="mt-1 text-2xl font-bold text-green-600">
                        {lot.availableSlots}
                      </p>

                      <p className="text-xs text-slate-400">
                        of {lot.totalSlots} total
                      </p>
                    </div>

                    <Link
                      to="/booking"
                      className="px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition"
                    >
                      Book
                    </Link>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default Dashboard;
