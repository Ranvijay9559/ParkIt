import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import API from "../api/axios";

function Parking() {
  const [parkingLots, setParkingLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [availability, setAvailability] = useState(null);

  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    API.get("/parking/lots")
      .then((response) => { if (active) setParkingLots(response.data.parkingLots || []); })
      .catch((error) => {
        if (active) setError(error.response?.data?.message || "Failed to load parking locations");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const socket = io(API.defaults.baseURL.replace(/\/api\/?$/, ""));
    let active = true;
    socket.on("parking:availability", ({ lotId }) => {
      API.get("/parking/lots").then((response) => {
        if (!active) return;
        const lots = response.data.parkingLots || [];
        setParkingLots(lots);
        if (selectedLot?._id === lotId) {
          const updatedLot = lots.find((lot) => lot._id === lotId);
          if (updatedLot) setSelectedLot(updatedLot);
          return Promise.all([
            API.get(`/parking/lots/${lotId}/slots`),
            API.get(`/parking/lots/${lotId}/availability`)
          ]).then(([slotResponse, availabilityResponse]) => {
            if (!active) return;
            setSlots(slotResponse.data.slots || []);
            setAvailability(availabilityResponse.data);
          });
        }
      }).catch((error) => {
        if (active) setError(error.response?.data?.message || "Could not refresh parking availability.");
      });
    });
    return () => {
      active = false;
      socket.disconnect();
    };
  }, [selectedLot]);

  const viewParkingLot = async (lot) => {
    try {
      setSelectedLot(lot);
      setSlotsLoading(true);
      setError("");

      const [slotsResponse, availabilityResponse] =
        await Promise.all([
          API.get(`/parking/lots/${lot._id}/slots`),
          API.get(`/parking/lots/${lot._id}/availability`)
        ]);

      setSlots(slotsResponse.data.slots || []);
      setAvailability(availabilityResponse.data);
    } catch (error) {
      console.error("Failed to load parking details:", error);

      setError(
        error.response?.data?.message ||
          "Failed to load parking details"
      );
    } finally {
      setSlotsLoading(false);
    }
  };

  const closeParkingDetails = () => {
    setSelectedLot(null);
    setSlots([]);
    setAvailability(null);
  };

  const getSlotStyle = (status) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 border-green-300 text-green-700";

      case "RESERVED":
        return "bg-yellow-100 border-yellow-300 text-yellow-700";

      case "OCCUPIED":
        return "bg-red-100 border-red-300 text-red-700";

      case "MAINTENANCE":
        return "bg-slate-200 border-slate-300 text-slate-600";

      default:
        return "bg-slate-100 border-slate-300 text-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-slate-600">
            Loading parking locations...
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">

          <h1 className="text-3xl font-bold text-slate-900">
            Parking Locations
          </h1>

          <p className="mt-2 text-slate-500">
            Find available parking locations and check slot availability.
          </p>

        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Parking Lots */}
        {parkingLots.length === 0 ? (

          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">

            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500 text-xl">
              P
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No parking locations found
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              There are currently no parking locations available.
            </p>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {parkingLots.map((lot) => (

              <div
                key={lot._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
              >

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {lot.name}
                    </h2>

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

                {/* Availability */}
                <div className="mt-6">

                  <div className="flex items-end justify-between">

                    <div>
                      <p className="text-sm text-slate-500">
                        Available Slots
                      </p>

                      <p className="mt-1 text-3xl font-bold text-green-600">
                        {lot.availableSlots}
                      </p>
                    </div>

                    <p className="text-sm text-slate-400">
                      / {lot.totalSlots} total
                    </p>

                  </div>

                  {/* Progress */}
                  <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${
                          lot.totalSlots > 0
                            ? (lot.availableSlots /
                                lot.totalSlots) *
                              100
                            : 0
                        }%`
                      }}
                    ></div>

                  </div>

                </div>

                {/* Button */}
                <button
                  onClick={() => viewParkingLot(lot)}
                  className="mt-6 w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                >
                  View Slots
                </button>

              </div>

            ))}

          </div>

        )}

        {/* Selected Parking Lot */}
        {selectedLot && (

          <section className="mt-10">

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                <div>

                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedLot.name}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedLot.location}
                  </p>

                </div>

                <button
                  onClick={closeParkingDetails}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
                >
                  Close
                </button>

              </div>

              {/* Availability Stats */}
              {availability && (

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                      Total
                    </p>

                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {availability.total}
                    </p>
                  </div>

                  <div className="rounded-xl bg-green-50 p-4">
                    <p className="text-xs text-green-600">
                      Available
                    </p>

                    <p className="mt-1 text-2xl font-bold text-green-700">
                      {availability.available}
                    </p>
                  </div>

                  <div className="rounded-xl bg-yellow-50 p-4">
                    <p className="text-xs text-yellow-600">
                      Reserved
                    </p>

                    <p className="mt-1 text-2xl font-bold text-yellow-700">
                      {availability.reserved}
                    </p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-xs text-red-600">
                      Occupied
                    </p>

                    <p className="mt-1 text-2xl font-bold text-red-700">
                      {availability.occupied}
                    </p>
                  </div>

                </div>

              )}

              {/* Legend */}
              <div className="mt-8 flex flex-wrap gap-4">

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  Available
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  Reserved
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  Occupied
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                  Maintenance
                </div>

              </div>

              {/* Slots */}
              <div className="mt-6">

                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Parking Slots
                </h3>

                {slotsLoading ? (

                  <div className="py-10 text-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

                    <p className="mt-3 text-sm text-slate-500">
                      Loading slots...
                    </p>
                  </div>

                ) : slots.length === 0 ? (

                  <div className="py-10 text-center bg-slate-50 rounded-xl">
                    <p className="text-slate-500">
                      No parking slots found.
                    </p>
                  </div>

                ) : (

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">

                    {slots.map((slot) => (

                      <div
                        key={slot._id}
                        className={`border-2 rounded-xl p-4 text-center ${getSlotStyle(
                          slot.status
                        )}`}
                      >

                        <div className="text-lg font-bold">
                          {slot.slotNumber}
                        </div>

                        <div className="mt-1 text-xs">
                          {slot.status}
                        </div>

                        <div className="mt-2 text-xs opacity-75">
                          {slot.vehicleType}
                        </div>

                      </div>

                    ))}

                  </div>

                )}

              </div>

              {/* Book Button */}
              <div className="mt-8 flex justify-end">

                <Link
                  to="/booking"
                  className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                >
                  Book a Parking Slot
                </Link>

              </div>

            </div>

          </section>

        )}

      </main>

    </div>
  );
}

export default Parking;
