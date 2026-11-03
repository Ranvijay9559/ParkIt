import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import { subscribeToParkingUpdates } from "../services/parking-realtime";

const getNextMinuteLocal = () => {
  const nextMinute = new Date();
  nextMinute.setSeconds(0, 0);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  return new Date(nextMinute.getTime() - nextMinute.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Booking() {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([]);
  const [parkingLots, setParkingLots] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [minimumStartTime, setMinimumStartTime] = useState("");

  const [formData, setFormData] = useState({
    vehicleId: "",
    parkingLotId: "",
    startTime: "",
    expectedEndTime: ""
  });

  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const refreshMinimum = () => setMinimumStartTime(getNextMinuteLocal());
    const initialUpdate = setTimeout(refreshMinimum, 0);
    const interval = setInterval(refreshMinimum, 15000);
    return () => { clearTimeout(initialUpdate); clearInterval(interval); };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([API.get("/vehicles"), API.get("/parking/lots"), API.get("/pricing")])
      .then(([vehicleResponse, parkingResponse, pricingResponse]) => {
        if (!active) return;
        setVehicles(vehicleResponse.data.vehicles || []);
        setParkingLots(parkingResponse.data.parkingLots || []);
        setPricingRules(pricingResponse.data || []);
      })
      .catch((error) => {
        if (active) setError(error.response?.data?.message || "Failed to load booking information");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshLots = async () => {
      try {
        const response = await API.get("/parking/lots");
        if (!active) return;
        const nextLots = response.data.parkingLots || [];
        setParkingLots(nextLots);
        setSelectedLot((current) => current ? nextLots.find((lot) => lot._id === current._id) || current : null);
      } catch {
        // Keep the last known view when a background refresh briefly fails.
      }
    };
    const refreshForLot = (event) => {
      refreshLots();
      if (selectedLot?._id && event?.lotId === selectedLot._id) {
        API.get(`/parking/lots/${selectedLot._id}/slots`).then((response) => {
          if (active) { setSelectedSlots(response.data.slots || []); setAvailabilityUpdatedAt(new Date()); }
        }).catch(() => {});
      }
    };
    const unsubscribe = subscribeToParkingUpdates(refreshForLot);
    const poll = setInterval(() => {
      refreshLots();
      if (selectedLot?._id) {
        API.get(`/parking/lots/${selectedLot._id}/slots`).then((response) => {
          if (active) { setSelectedSlots(response.data.slots || []); setAvailabilityUpdatedAt(new Date()); }
        }).catch(() => {});
      }
    }, 10000);
    return () => { active = false; clearInterval(poll); unsubscribe(); };
  }, [selectedLot?._id]);

  useEffect(() => {
    let active = true;
    if (!selectedLot?._id) return undefined;
    const refreshSlots = async () => {
      try {
        const response = await API.get(`/parking/lots/${selectedLot._id}/slots`);
        if (active) { setSelectedSlots(response.data.slots || []); setAvailabilityUpdatedAt(new Date()); }
      } catch {
        // Keep the last known slot state until the next refresh.
      }
    };
    refreshSlots();
    return () => { active = false; };
  }, [selectedLot?._id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
      ...(name === "startTime" && formData.expectedEndTime && formData.expectedEndTime <= value ? { expectedEndTime: "" } : {})
    });

    if (name === "startTime" && value && minimumStartTime && value < minimumStartTime) {
      setError("Choose a start time in the future.");
    }

    if (name === "parkingLotId") {
      setSelectedSlots([]);
      const lot = parkingLots.find(
        (parkingLot) => parkingLot._id === value
      );

      setSelectedLot(lot || null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!formData.vehicleId) {
      setError("Please select a vehicle.");
      return;
    }

    if (!formData.parkingLotId) {
      setError("Please select a parking location.");
      return;
    }

    if (!formData.startTime || !formData.expectedEndTime) {
      setError("Please select both start and end time.");
      return;
    }

    const start = new Date(formData.startTime);
    const end = new Date(formData.expectedEndTime);

    if (formData.startTime < minimumStartTime || start.getTime() <= Date.now()) {
      setError("Choose a start time in the future.");
      return;
    }

    if (end <= start) {
      setError("Expected end time must be after start time.");
      return;
    }

    const reservedMinutes = (end - start) / 60000;
    if (reservedMinutes < 30 || reservedMinutes > 120) {
      setError("Choose a reservation duration between 30 minutes and 2 hours.");
      return;
    }

    try {
      setBookingLoading(true);

      const response = await API.post("/bookings", {
        vehicleId: formData.vehicleId,
        parkingLotId: formData.parkingLotId,
        startTime: start.toISOString(),
        expectedEndTime: end.toISOString()
      });

      setSuccess(
        `Demo payment of INR ${response.data.booking.reservationAmount} recorded for the reserved period. Booking ID: ${response.data.booking.bookingId}. No real money was charged.`
      );

      setFormData({
        vehicleId: "",
        parkingLotId: "",
        startTime: "",
        expectedEndTime: ""
      });

      setSelectedLot(null);

      setTimeout(() => {
        navigate("/my-bookings");
      }, 1500);

    } catch (error) {
      console.error("Booking failed:", error);

      setError(
        error.response?.data?.message ||
          "Failed to create booking"
      );
    } finally {
      setBookingLoading(false);
    }
  };

  const selectedVehicle = vehicles.find((vehicle) => vehicle._id === formData.vehicleId);
  const selectedPricingRule = pricingRules.find((rule) => rule.vehicleType === selectedVehicle?.vehicleType && rule.status === "ACTIVE");
  const reservedMinutes = formData.startTime && formData.expectedEndTime
    ? (new Date(formData.expectedEndTime) - new Date(formData.startTime)) / 60000
    : 0;
  const billedHours = reservedMinutes > 0 ? Math.ceil(reservedMinutes / 60) : 0;
  const reservationAmount = selectedPricingRule && billedHours > 0
    ? selectedPricingRule.baseRate + billedHours * selectedPricingRule.ratePerHour
    : null;
  const arrivalGraceMinutes = reservedMinutes >= 30 && reservedMinutes <= 120
    ? Math.ceil(reservedMinutes / 3)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">

          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-slate-600">
            Loading booking information...
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">

          <h1 className="text-3xl font-bold text-slate-900">
            Book a Parking Slot
          </h1>

          <p className="mt-2 text-slate-500">
            Select your vehicle, parking location and parking duration.
          </p>
          <p className="mt-2 text-sm text-amber-800">
            Arrival policy: check in within one-third of your reserved duration (10 minutes for 30 minutes, 20 minutes for 60 minutes). After that, the reservation is cancelled and the slot released.
          </p>

        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* No Vehicles */}
        {vehicles.length === 0 ? (

          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">

            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-600 text-xl">
              V
            </div>

            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              No vehicles registered
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              You need to register a vehicle before making a booking.
            </p>

            <p className="mt-5 text-sm text-slate-500">
              Vehicle management will be added to the dashboard shortly.
            </p>

          </div>

        ) : (

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8"
          >

            {/* Step 1 */}
            <div>

              <div className="flex items-center gap-3 mb-5">

                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                  1
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Select Vehicle
                  </h2>

                  <p className="text-sm text-slate-500">
                    Choose the vehicle you want to park.
                  </p>
                </div>

              </div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vehicle
              </label>

              <select
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select a vehicle
                </option>

                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle._id}
                    value={vehicle._id}
                  >
                    {vehicle.vehicleNumber} —{" "}
                    {vehicle.vehicleType}
                  </option>
                ))}

              </select>

            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 my-8"></div>

            {/* Step 2 */}
            <div>

              <div className="flex items-center gap-3 mb-5">

                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                  2
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Select Parking Location
                  </h2>

                  <p className="text-sm text-slate-500">
                    Choose where you want to park.
                  </p>
                </div>

              </div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Parking Location
              </label>

              <select
                name="parkingLotId"
                value={formData.parkingLotId}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Select a parking location
                </option>

                {parkingLots
                  .filter(
                    (lot) =>
                      lot.status === "ACTIVE" &&
                      lot.availableSlots > 0
                  )
                  .map((lot) => (
                    <option
                      key={lot._id}
                      value={lot._id}
                    >
                      {lot.name} — {lot.location} —{" "}
                      {lot.availableSlots} slots available
                    </option>
                  ))}

              </select>

              {/* Selected Lot */}
              {selectedLot && (
                <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedLot.name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {selectedLot.location}
                      </p>
                    </div>

                    <div className="text-right">

                      <p className="text-xs text-slate-500">
                        Available
                      </p>

                      <p className="text-xl font-bold text-green-600">
                        {selectedLot.availableSlots}
                      </p>

                    </div>

                  </div>

                  <div className="mt-5 pt-4 border-t border-blue-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">Live parking map</p>
                      <span className="text-xs text-slate-500">{availabilityUpdatedAt ? `Updated ${availabilityUpdatedAt.toLocaleTimeString()}` : "Connecting…"}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {selectedSlots.map((slot) => (
                        <div key={slot._id} title={`${slot.slotNumber}: ${slot.status}`} className={`rounded-lg border px-2 py-2 text-center ${slot.status === "AVAILABLE" ? "bg-white border-green-300 text-green-800" : slot.status === "RESERVED" ? "bg-amber-100 border-amber-300 text-amber-800" : slot.status === "OCCUPIED" ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-slate-200 border-slate-300 text-slate-600"}`}>
                          <span className="block text-xs font-bold">{slot.slotNumber}</span>
                          <span className="block text-[10px] mt-0.5">{slot.status === "AVAILABLE" ? "Free" : slot.status === "RESERVED" ? "Booked" : slot.status === "OCCUPIED" ? "In use" : "Closed"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>🟢 Free</span><span>🟡 Reserved</span><span>🔴 Occupied</span><span>⚪ Maintenance</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Slot states refresh live when connected, with a 10-second refresh fallback. ParkIt assigns a compatible available slot when you confirm this booking.</p>
                  </div>

                </div>
              )}

            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 my-8"></div>

            {/* Step 3 */}
            <div>

              <div className="flex items-center gap-3 mb-5">

                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                  3
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Select Parking Time
                  </h2>

                  <p className="text-sm text-slate-500">
                    Choose when you will enter and leave.
                  </p>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Start */}
                <div>

                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Start Time
                  </label>

                  <input
                    type="datetime-local"
                    name="startTime"
                    min={minimumStartTime || undefined}
                    value={formData.startTime}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <p className="mt-2 text-xs text-amber-700">
                    {arrivalGraceMinutes && formData.startTime
                      ? `Check in by ${new Date(new Date(formData.startTime).getTime() + arrivalGraceMinutes * 60 * 1000).toLocaleString()} (${arrivalGraceMinutes}-minute grace).`
                      : "Arrival grace is one-third of the booked duration. Reservations must be 30 minutes to 2 hours."}
                  </p>

                </div>

                {/* End */}
                <div>

                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expected End Time
                  </label>

                  <input
                    type="datetime-local"
                    name="expectedEndTime"
                    min={formData.startTime || minimumStartTime || undefined}
                    value={formData.expectedEndTime}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

              </div>

            </div>

            {/* Booking Summary */}
            <div className="mt-8 rounded-xl bg-slate-50 border border-slate-200 p-5">

              <h3 className="font-semibold text-slate-900">
                Booking Summary
              </h3>

              <div className="mt-4 space-y-3 text-sm">

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Vehicle
                  </span>

                  <span className="font-medium text-slate-900">
                    {formData.vehicleId
                      ? vehicles.find(
                          (vehicle) =>
                            vehicle._id ===
                            formData.vehicleId
                        )?.vehicleNumber || "-"
                      : "-"}
                  </span>

                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Reserved duration</span>
                  <span className="font-medium text-slate-900">{reservedMinutes > 0 ? `${Math.ceil(reservedMinutes)} minutes` : "-"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Due now for reserved time</span>
                  <span className="font-semibold text-slate-900">{reservationAmount === null ? "Select vehicle and times" : `INR ${reservationAmount}`}</span>
                </div>
                {reservationAmount !== null && selectedPricingRule && billedHours > 0 && <p className="text-xs text-slate-500">Calculation: INR {selectedPricingRule.baseRate} base + INR {selectedPricingRule.ratePerHour} × {billedHours} billed hour(s). Partial hours round up.</p>}

                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  Demo payment only: this simulates collecting the reserved-period charge now. Any eligible extra-time charge is calculated at exit. No real money is charged.
                </p>

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Parking
                  </span>

                  <span className="font-medium text-slate-900">
                    {selectedLot?.name || "-"}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Start
                  </span>

                  <span className="font-medium text-slate-900">
                    {formData.startTime || "-"}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Expected End
                  </span>

                  <span className="font-medium text-slate-900">
                    {formData.expectedEndTime || "-"}
                  </span>

                </div>

              </div>

            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={bookingLoading}
              className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bookingLoading
                ? "Creating Booking..."
              : reservationAmount === null
                ? "Confirm Parking Booking"
                : `Confirm booking · simulate INR ${reservationAmount} payment`}
            </button>

          </form>

        )}

      </main>

    </div>
  );
}

export default Booking;
