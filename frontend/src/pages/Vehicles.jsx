import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

function Vehicles() {
  const [vehicles, setVehicles] = useState([]);

  const [formData, setFormData] = useState({
    vehicleNumber: "",
    vehicleType: "CAR"
  });

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    API.get("/vehicles")
      .then((response) => { if (active) setVehicles(response.data.vehicles || []); })
      .catch((error) => {
        if (active) setError(error.response?.data?.message || "Failed to load vehicles");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/vehicles");

      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error("Failed to load vehicles:", error);

      setError(
        error.response?.data?.message ||
          "Failed to load vehicles"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!formData.vehicleNumber.trim()) {
      setError("Please enter a vehicle number.");
      return;
    }

    try {
      setAdding(true);

      await API.post("/vehicles", {
        vehicleNumber: formData.vehicleNumber.toUpperCase(),
        vehicleType: formData.vehicleType
      });

      setSuccess("Vehicle registered successfully.");

      setFormData({
        vehicleNumber: "",
        vehicleType: "CAR"
      });

      await loadVehicles();
    } catch (error) {
      console.error("Vehicle registration failed:", error);

      setError(
        error.response?.data?.message ||
          "Failed to register vehicle"
      );
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">

          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-slate-600">
            Loading your vehicles...
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

            <Link
              to="/dashboard"
              className="text-sm font-medium text-slate-600 hover:text-blue-600"
            >
              ← Dashboard
            </Link>

          </div>

        </div>

      </nav>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">

          <h1 className="text-3xl font-bold text-slate-900">
            My Vehicles
          </h1>

          <p className="mt-2 text-slate-500">
            Register and manage the vehicles you use for parking.
          </p>

        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Register Vehicle */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">

          <h2 className="text-xl font-bold text-slate-900">
            Register a Vehicle
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Add your vehicle before making a parking booking.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5"
          >

            {/* Vehicle Number */}
            <div className="md:col-span-1">

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vehicle Number
              </label>

              <input
                type="text"
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={handleChange}
                placeholder="PB10AB1234"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

            </div>

            {/* Vehicle Type */}
            <div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vehicle Type
              </label>

              <select
                name="vehicleType"
                value={formData.vehicleType}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="CAR">
                  Car
                </option>

                <option value="BIKE">
                  Bike
                </option>

                <option value="SUV">
                  SUV
                </option>

                <option value="TRUCK">
                  Truck
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>

            </div>

            {/* Button */}
            <div className="flex items-end">

              <button
                type="submit"
                disabled={adding}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding
                  ? "Registering..."
                  : "Register Vehicle"}
              </button>

            </div>

            <Link
              to="/vehicle-scan"
              className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
            >
              Scan Vehicle
            </Link>

          </form>

        </section>

        {/* Vehicle List */}
        <section className="mt-8">

          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Registered Vehicles
          </h2>

          {vehicles.length === 0 ? (

            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">

              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-600 text-xl">
                V
              </div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No vehicles registered
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Register your first vehicle above.
              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

              {vehicles.map((vehicle) => (

                <div
                  key={vehicle._id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
                >

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Vehicle Number
                      </p>

                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        {vehicle.vehicleNumber}
                      </h3>

                    </div>

                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      V
                    </div>

                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-100">

                    <div className="flex justify-between">

                      <span className="text-sm text-slate-500">
                        Type
                      </span>

                      <span className="text-sm font-semibold text-slate-900">
                        {vehicle.vehicleType}
                      </span>

                    </div>

                    <div className="mt-3 flex justify-between">

                      <span className="text-sm text-slate-500">
                        Registered By
                      </span>

                      <span className="text-sm font-semibold text-slate-900">
                        {vehicle.registeredBy}
                      </span>

                    </div>

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

export default Vehicles;
