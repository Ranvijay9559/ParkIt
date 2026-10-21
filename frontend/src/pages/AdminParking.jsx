import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../api/axios";

function AdminParking() {
  const [searchParams] = useSearchParams();
  const requestedLotId = searchParams.get("lotId");
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [slots, setSlots] = useState([]);

  const [lotForm, setLotForm] = useState({
    name: "",
    location: "",
    totalSlots: ""
  });

  const [slotForm, setSlotForm] = useState({
    slotNumber: "",
    floor: 1,
    vehicleType: "CAR",
    distanceFromEntry: 0,
    priority: 1
  });

  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [demoOccupancy, setDemoOccupancy] = useState(65);

  const loadLots = useCallback(async () => {
    try {
      const response = await API.get("/parking/lots");

      const parkingLots = response.data.parkingLots || [];
      setLots(parkingLots);

      if (parkingLots.length > 0) setSelectedLotId((current) => requestedLotId || current || parkingLots[0]._id);
    } catch (error) {
      console.error("Failed to load parking lots:", error);

      setError(
        error.response?.data?.message ||
          "Failed to load parking lots."
      );
    }
  }, [requestedLotId]);

  const loadSlots = useCallback(async (lotId) => {
    try {
      setSlotsLoading(true);

      const response = await API.get(`/parking/lots/${lotId}/manage-slots`);

      setSlots(response.data.slots || []);
    } catch (error) {
      console.error("Failed to load slots:", error);

      setError(
        error.response?.data?.message ||
          "Failed to load parking slots."
      );
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    API.get("/parking/lots").then((response) => {
      if (!active) return;
      const parkingLots = response.data.parkingLots || [];
      setLots(parkingLots);
      if (parkingLots.length > 0) setSelectedLotId((current) => requestedLotId || current || parkingLots[0]._id);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Failed to load parking lots.");
    });
    return () => { active = false; };
  }, [requestedLotId]);

  useEffect(() => {
    if (!selectedLotId) return undefined;
    let active = true;
    API.get(`/parking/lots/${selectedLotId}/manage-slots`).then((response) => {
      if (active) setSlots(response.data.slots || []);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Failed to load parking slots.");
    }).finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [selectedLotId]);

  const handleLotChange = (e) => {
    setLotForm({
      ...lotForm,
      [e.target.name]: e.target.value
    });
  };

  const handleSlotChange = (e) => {
    setSlotForm({
      ...slotForm,
      [e.target.name]: e.target.value
    });
  };

  const createParkingLot = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (
      !lotForm.name.trim() ||
      !lotForm.location.trim() ||
      !lotForm.totalSlots
    ) {
      setError("Please fill all parking lot fields.");
      return;
    }

    if (Number(lotForm.totalSlots) < 1) {
      setError(
        "Total slots must be at least 1."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await API.post(
        "/parking/lots",
        {
          name: lotForm.name.trim(),
          location: lotForm.location.trim(),
          totalSlots: Number(lotForm.totalSlots)
        }
      );

      setSuccess(
        "Parking lot created successfully."
      );

      setLotForm({
        name: "",
        location: "",
        totalSlots: ""
      });

      await loadLots();

      if (response.data.parkingLot?._id) {
        setSelectedLotId(response.data.parkingLot._id);
      }
    } catch (error) {
      console.error(
        "Create parking lot failed:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to create parking lot."
      );
    } finally {
      setLoading(false);
    }
  };

  const createParkingSlot = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedLotId) {
      setError(
        "Please select a parking lot."
      );
      return;
    }

    if (!slotForm.slotNumber.trim()) {
      setError(
        "Please enter a slot number."
      );
      return;
    }

    try {
      setLoading(true);

      await API.post("/parking/slots", {
        lotId: selectedLotId,
        slotNumber: slotForm.slotNumber.trim(),
        floor: Number(slotForm.floor),
        vehicleType: slotForm.vehicleType,
        distanceFromEntry: Number(
          slotForm.distanceFromEntry
        ),
        priority: Number(slotForm.priority)
      });

      setSuccess(
        "Parking slot created successfully."
      );

      setSlotForm({
        slotNumber: "",
        floor: 1,
        vehicleType: "CAR",
        distanceFromEntry: 0,
        priority: 1
      });

      await loadSlots(selectedLotId);
      await loadLots();
    } catch (error) {
      console.error(
        "Create parking slot failed:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Failed to create parking slot."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedLot = lots.find(
    (lot) => lot._id === selectedLotId
  );

  const generateDemoLot = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const response = await API.post("/parking/demo-lots", { capacity: 12 });
      const lot = response.data.parkingLot;
      setSuccess(`Generated ${lot.name} with ${response.data.slotsCreated} demo slots.`);
      await loadLots();
      setSelectedLotId(lot._id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not generate demo lot.");
    } finally { setLoading(false); }
  };

  const simulateLot = async () => {
    if (!selectedLotId) return setError("Select a lot to simulate.");
    setError(""); setSuccess(""); setLoading(true);
    try {
      const response = await API.post(`/parking/lots/${selectedLotId}/simulate`, { occupancyPercent: Number(demoOccupancy) });
      setSuccess(`${response.data.message}: ${response.data.simulatedEntries} demo arrivals and ${response.data.simulatedCheckouts} demo checkouts. ${response.data.availability.occupied}/${response.data.availability.total} occupied.`);
      await loadSlots(selectedLotId); await loadLots();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not simulate occupancy.");
    } finally { setLoading(false); }
  };

  const removeSlot = async (slot) => {
    const confirmed = window.confirm(`Remove slot ${slot.slotNumber} from service? It will disappear from customer availability, while historical booking records remain available.`);
    if (!confirmed) return;
    setError(""); setSuccess(""); setLoading(true);
    try {
      const response = await API.delete(`/parking/slots/${slot._id}`);
      setSuccess(response.data.message || `Slot ${slot.slotNumber} removed from service.`);
      await loadSlots(selectedLotId);
      await loadLots();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not remove this slot.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar */}

      <nav className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <Link
              to="/admin"
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
                P
              </div>

              <span className="text-xl font-bold">
                Park<span className="text-blue-400">
                  It
                </span>
              </span>

              <span className="hidden sm:inline-block ml-2 px-2 py-1 text-xs bg-slate-700 rounded">
                ADMIN
              </span>
            </Link>

            <Link
              to="/admin"
              className="text-sm text-slate-300 hover:text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Parking Management
          </h1>

          <p className="mt-2 text-slate-500">
            Create and manage parking locations and
            parking slots.
          </p>
        </div>

        {/* Messages */}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <section className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Demo lot simulator</h2>
              <p className="text-sm text-slate-500 mt-1">Generate sample capacity, then reconcile arrivals and departures against real demo sessions.</p>
            </div>
            <button onClick={generateDemoLot} disabled={loading} className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Generate 12-slot demo lot</button>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <label className="text-sm text-slate-700">Target occupancy: <strong>{demoOccupancy}%</strong>
              <input aria-label="Target demo occupancy" type="range" min="0" max="100" step="10" value={demoOccupancy} onChange={(event) => setDemoOccupancy(event.target.value)} className="block w-64 mt-2" />
            </label>
            <button onClick={simulateLot} disabled={loading || !selectedLotId} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Recheck & simulate arrivals / checkouts</button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Parking Lot */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                Create Parking Lot
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Add a new parking location.
              </p>
            </div>

            <form
              onSubmit={createParkingLot}
              className="p-6 space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Parking Lot Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={lotForm.name}
                  onChange={handleLotChange}
                  placeholder="e.g. Main Campus Parking"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Location
                </label>

                <input
                  type="text"
                  name="location"
                  value={lotForm.location}
                  onChange={handleLotChange}
                  placeholder="e.g. Block A, Main Gate"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Slots
                </label>

                <input
                  type="number"
                  name="totalSlots"
                  min="1"
                  value={lotForm.totalSlots}
                  onChange={handleLotChange}
                  placeholder="e.g. 50"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />

                <p className="text-xs text-slate-500 mt-2">
                  This sets the capacity of the parking
                  lot. Individual slots are created
                  separately below.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg transition"
              >
                {loading
                  ? "Creating..."
                  : "Create Parking Lot"}
              </button>
            </form>
          </div>

          {/* Create Parking Slot */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                Create Parking Slot
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Add an individual slot to a parking lot.
              </p>
            </div>

            <form
              onSubmit={createParkingSlot}
              className="p-6 space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Parking Lot
                </label>

                <select
                  value={selectedLotId}
                  onChange={(e) => {
                    setSlotsLoading(true);
                    setSlots([]);
                    setSelectedLotId(e.target.value);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    Select parking lot
                  </option>

                  {lots.map((lot) => (
                    <option
                      key={lot._id}
                      value={lot._id}
                    >
                      {lot.name} - {lot.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Slot Number
                </label>

                <input
                  type="text"
                  name="slotNumber"
                  value={slotForm.slotNumber}
                  onChange={handleSlotChange}
                  placeholder="e.g. A-01"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Floor
                  </label>

                  <input
                    type="number"
                    name="floor"
                    min="1"
                    value={slotForm.floor}
                    onChange={handleSlotChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Vehicle Type
                  </label>

                  <select
                    name="vehicleType"
                    value={slotForm.vehicleType}
                    onChange={handleSlotChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Distance From Entry
                  </label>

                  <input
                    type="number"
                    name="distanceFromEntry"
                    min="0"
                    value={
                      slotForm.distanceFromEntry
                    }
                    onChange={handleSlotChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Priority
                  </label>

                  <input
                    type="number"
                    name="priority"
                    min="1"
                    value={slotForm.priority}
                    onChange={handleSlotChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedLotId}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-lg transition"
              >
                {loading
                  ? "Creating..."
                  : "Create Parking Slot"}
              </button>
            </form>
          </div>
        </div>

        {/* Current Lot */}

        <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              Parking Slots
            </h2>

            {selectedLot && (
              <p className="text-sm text-slate-500 mt-1">
                {selectedLot.name} —{" "}
                {selectedLot.location}
              </p>
            )}
          </div>

          <div className="p-6">
            {!selectedLotId ? (
              <div className="text-center py-8 text-slate-500">
                Select a parking lot to view its slots.
              </div>
            ) : slotsLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

                <p className="mt-3 text-sm text-slate-500">
                  Loading slots...
                </p>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">
                  🅿️
                </div>

                <p className="font-medium text-slate-900">
                  No slots created yet
                </p>

                <p className="text-sm text-slate-500 mt-1">
                  Use the form above to create the first
                  slot.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {slots.map((slot) => (
                  <div
                    key={slot._id}
                    className="border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {slot.slotNumber}
                      </span>

                      <span
                        className={`w-3 h-3 rounded-full ${
                          slot.status ===
                          "AVAILABLE"
                            ? "bg-green-500"
                            : slot.status ===
                              "OCCUPIED"
                            ? "bg-red-500"
                            : slot.status ===
                              "RESERVED"
                            ? "bg-yellow-500"
                            : "bg-slate-400"
                        }`}
                      ></span>
                    </div>

                    <p className="text-xs text-slate-500 mt-3">
                      Floor {slot.floor}
                    </p>

                    <p className="text-xs text-slate-500">
                      {slot.vehicleType}
                    </p>

                    <p className="text-xs font-medium mt-2 text-slate-700">
                      {slot.status === "DECOMMISSIONED" ? "REMOVED" : slot.status}
                    </p>

                    {slot.status !== "DECOMMISSIONED" && <button
                      type="button"
                      onClick={() => removeSlot(slot)}
                      disabled={loading || !["AVAILABLE", "MAINTENANCE"].includes(slot.status)}
                      title={slot.status === "RESERVED" || slot.status === "OCCUPIED" ? "Release the reservation or check out the vehicle before removing this slot." : "Remove this slot from service"}
                      className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove slot
                    </button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminParking;
