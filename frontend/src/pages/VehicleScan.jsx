import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

function VehicleScan() {
  const navigate = useNavigate();
  const isAdminExit = window.location.pathname === "/admin/exit-scan";
  const isAdminEntry = window.location.pathname === "/admin/entry-scan";
  const isAdminGate = isAdminEntry || isAdminExit;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("CAR");
  const [entryBookings, setEntryBookings] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [entryLots, setEntryLots] = useState([]);
  const [entrySlots, setEntrySlots] = useState([]);
  const [entryLotId, setEntryLotId] = useState("");
  const [entrySlotId, setEntrySlotId] = useState("");
  const [walkInDuration, setWalkInDuration] = useState(60);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (!isAdminEntry) return undefined;
    let active = true;
    API.get("/parking/lots").then((response) => {
      if (!active) return;
      const lots = response.data.parkingLots || [];
      setEntryLots(lots);
      setEntryLotId((current) => current || lots[0]?._id || "");
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Could not load parking lots for walk-in entry.");
    });
    return () => { active = false; };
  }, [isAdminEntry]);

  useEffect(() => {
    if (!isAdminEntry || !entryLotId) return undefined;
    let active = true;
    API.get(`/parking/lots/${entryLotId}/slots`).then((response) => {
      if (!active) return;
      const slots = response.data.slots || [];
      setEntrySlots(slots);
      setEntrySlotId((current) => slots.some((slot) => slot._id === current && slot.status === "AVAILABLE" && slot.vehicleType === vehicleType)
        ? current
        : slots.find((slot) => slot.status === "AVAILABLE" && slot.vehicleType === vehicleType)?._id || "");
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Could not load available slots.");
    });
    return () => { active = false; };
  }, [isAdminEntry, entryLotId, vehicleType]);

  useEffect(() => {
    if (!isAdminExit) return undefined;
    let active = true;
    API.get("/sessions/admin/active").then((response) => {
      if (active) setActiveSessions(response.data.sessions || []);
    }).catch(() => {});
    return () => { active = false; };
  }, [isAdminExit]);

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !cameraStarted || !video) return undefined;

    video.srcObject = stream;
    video.play().catch((playError) => {
      console.error("Camera preview error:", playError);
      setError("The camera opened, but its preview could not start. Please try again.");
    });

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream, cameraStarted]);

  const startCamera = async () => {
    setError("");
    setSuccess("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not available. Open this page in a supported browser over HTTPS.");
        return;
      }

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" }
          },
          audio: false
        });

      setStream(mediaStream);
      setCameraReady(false);
      setCameraStarted(true);
    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        setError("Camera permission is blocked. Allow camera access for this site in your browser settings, then try again.");
      } else if (error.name === "NotFoundError") {
        setError("No camera was found on this device.");
      } else {
        setError("Unable to start the camera. Check that no other app is using it, then try again.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    setStream(null);
    setCameraStarted(false);
    setCameraReady(false);
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    setError("");
    setSuccess("");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const preview = previewRef.current;

    if (!video.videoWidth || !video.videoHeight) {
      setError("The camera is still starting. Please wait a moment and try again.");
      return;
    }

    if (!preview) return;

    // Crop to the guide so OCR receives the plate instead of the full frame.
    // Compensate for the video element's object-cover crop on mobile cameras.
    const frameWidth = preview.clientWidth;
    const frameHeight = preview.clientHeight;
    const visibleWidth = Math.min(video.videoWidth, video.videoHeight * frameWidth / frameHeight);
    const visibleHeight = Math.min(video.videoHeight, video.videoWidth * frameHeight / frameWidth);
    const visibleLeft = (video.videoWidth - visibleWidth) / 2;
    const visibleTop = (video.videoHeight - visibleHeight) / 2;
    const cropX = visibleLeft + visibleWidth * 0.1;
    const cropY = visibleTop + visibleHeight / 3;
    const cropWidth = visibleWidth * 0.8;
    const cropHeight = visibleHeight / 3;

    canvas.width = Math.round(cropWidth);
    canvas.height = Math.round(cropHeight);

    const context = canvas.getContext("2d");
    context.filter = "grayscale(1) contrast(1.35)";
    context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    context.filter = "none";

    const image = canvas.toDataURL("image/jpeg", 0.9);

    setCapturedImage(image);

    stopCamera();

    await scanVehicle(image);
  };

  const scanVehicle = async (image) => {
    try {
      setScanning(true);
      setError("");
      setSuccess("");

      const response = await API.post("/anpr/scan", { image }, { timeout: 65000 });

      const detectedNumber =
        response.data.vehicleNumber;

      if (detectedNumber) {
        setVehicleNumber(
          detectedNumber.toUpperCase()
        );

        setSuccess(
          `Vehicle number detected: ${detectedNumber}`
        );
        if (isAdminEntry) await lookupEntryBookings(detectedNumber);
      } else {
        setError(
          "Vehicle number could not be detected. Please enter it manually."
        );
      }
    } catch (error) {
      console.error("ANPR scan failed:", error);

      const rawText = error.response?.data?.rawText?.trim();
      setError(
        rawText
          ? `Could not identify a plate. OCR read: ${rawText || "no text"}. Center the plate in the guide and try again.`
          : error.code === "ECONNABORTED" || error.response?.status === 504
            ? "Plate scanning took too long. Please retake the photo or enter the number manually."
            : !error.response
              ? "The scan server did not respond. Please try once more or enter the number manually."
          : error.response?.data?.message || "Vehicle number detection failed. Please enter the number manually."
      );
    } finally {
      setScanning(false);
    }
  };

  const lookupEntryBookings = async (plate = vehicleNumber) => {
    setError(""); setSuccess(""); setEntryBookings([]);
    if (!plate.trim()) return setError("Scan or enter a vehicle number first.");
    try {
      setLoading(true);
      const response = await API.post("/sessions/admin/entry-matches", { vehicleNumber: plate.trim().toUpperCase() });
      setEntryBookings(response.data.bookings || []);
      setSuccess(`Found ${response.data.bookings?.length || 0} confirmed booking(s) for ${response.data.vehicle.vehicleNumber}. Select the reservation that matches the vehicle at the gate.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not find a confirmed booking for this plate.");
    } finally { setLoading(false); }
  };

  const recordAdminEntry = async (bookingId) => {
    setError(""); setSuccess("");
    try {
      setLoading(true);
      const response = await API.post("/sessions/admin/entry", { bookingId });
      setEntryBookings([]);
      setSuccess(`Entry recorded for ${vehicleNumber.toUpperCase()} at ${new Date(response.data.session.entryTime).toLocaleString()}. The reserved slot is now occupied.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not record vehicle entry.");
    } finally { setLoading(false); }
  };

  const recordWalkInEntry = async (event) => {
    event.preventDefault();
    setError(""); setSuccess("");
    if (!vehicleNumber.trim()) return setError("Scan or enter a vehicle number first.");
    if (!entryLotId || !entrySlotId) return setError("Choose an available slot for this vehicle type.");
    try {
      setLoading(true);
      const response = await API.post("/sessions/admin/walk-in-entry", {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleType,
        parkingLotId: entryLotId,
        parkingSlotId: entrySlotId,
        durationMinutes: Number(walkInDuration)
      });
      setEntryBookings([]);
      setSuccess(`Walk-in entry recorded for ${response.data.vehicle.vehicleNumber} at ${new Date(response.data.session.entryTime).toLocaleString()}. Slot occupied; demo charge will be calculated at exit.`);
      setVehicleNumber("");
      setCapturedImage(null);
      const slotsResponse = await API.get(`/parking/lots/${entryLotId}/slots`);
      setEntrySlots(slotsResponse.data.slots || []);
      setEntrySlotId("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not record walk-in entry.");
    } finally { setLoading(false); }
  };

  const retakeImage = () => {
    setCapturedImage(null);
    setVehicleNumber("");
    setError("");
    setSuccess("");

    startCamera();
  };

  const registerVehicle = async () => {
    setError("");
    setSuccess("");

    if (!vehicleNumber.trim()) {
      setError("Please enter the vehicle number.");
      return;
    }

    try {
      setLoading(true);

      await API.post("/vehicles", {
        vehicleNumber:
          vehicleNumber.trim().toUpperCase(),
        vehicleType
      });

      setSuccess(
        "Vehicle registered successfully."
      );

      setTimeout(() => {
        navigate("/vehicles");
      }, 1000);
    } catch (error) {
      console.error(
        "Vehicle registration failed:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Vehicle registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const completeAdminExit = async () => {
    setError("");
    setSuccess("");
    if (!vehicleNumber.trim()) return setError("Scan or enter a vehicle number first.");
    try {
      setLoading(true);
      const response = await API.post("/sessions/admin/exit-by-plate", {
        vehicleNumber: vehicleNumber.trim().toUpperCase()
      });
      setSuccess(`Checkout complete for ${vehicleNumber.toUpperCase()}. Fee: ₹${response.data.session?.totalAmount ?? 0}`);
    } catch (error) {
      setError(error.response?.data?.message || "Could not complete vehicle checkout.");
    } finally {
      setLoading(false);
    }
  };

  const completeManualSessionExit = async (session) => {
    setError(""); setSuccess("");
    try {
      setLoading(true);
      const response = await API.post("/sessions/exit", { sessionId: session._id });
      setActiveSessions((current) => current.filter((item) => item._id !== session._id));
      setSuccess(`Exit recorded for ${session.vehicleId?.vehicleNumber || "vehicle"}. Fee: ₹${response.data.session?.totalAmount ?? 0}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not complete manual checkout.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar */}

      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <Link
              to={isAdminGate ? "/admin" : "/dashboard"}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                P
              </div>

              <span className="text-xl font-bold text-slate-900">
                Park<span className="text-blue-600">
                  It
                </span>
              </span>
            </Link>

            <Link
              to={isAdminGate ? "/admin" : "/vehicles"}
              className="text-sm font-medium text-slate-600 hover:text-blue-600"
            >
                {isAdminGate ? "Admin Dashboard" : "My Vehicles"}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main */}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            {isAdminEntry ? "Vehicle Entrance Check-in" : isAdminExit ? "Vehicle Exit Checkout" : "Scan Vehicle"}
          </h1>

          <p className="mt-2 text-slate-500">
            {isAdminEntry
              ? "Scan the plate at the entrance, verify the matching reservation, then record the vehicle's actual arrival."
              : isAdminExit
                ? "Scan the plate at the exit. ParkIt will find its active session, calculate the fee, and release its slot."
                : "Capture the vehicle number plate and let ParkIt detect the registration number."}
          </p>
        </div>

        {/* Error */}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success */}

        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Section */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Vehicle Camera
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Center the full number plate inside the guide and hold the phone steady.
              </p>
            </div>

            <div className="p-6">
              {/* Camera preview */}

              <div ref={previewRef} className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                {!cameraStarted &&
                  !capturedImage && (
                    <div className="text-center text-white px-6">
                      <div className="text-4xl mb-3">
                        📷
                      </div>

                      <p className="text-sm text-slate-300">
                        Camera is not active
                      </p>
                    </div>
                  )}

                {cameraStarted && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onPlaying={() => setCameraReady(true)}
                    onWaiting={() => setCameraReady(false)}
                    className="w-full h-full object-cover"
                  />
                )}

                {capturedImage && (
                  <img
                    src={capturedImage}
                    alt="Captured vehicle"
                    className="w-full h-full object-cover"
                  />
                )}

                {cameraStarted && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-4/5 h-1/3 border-2 border-white rounded-lg">
                    </div>
                  </div>
                )}

                {scanning && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto">
                      </div>

                      <p className="mt-4 font-medium">
                        Detecting vehicle number...
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        Please wait
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas */}

              <canvas
                ref={canvasRef}
                className="hidden"
              />

              {/* Camera buttons */}

              <div className="mt-5 flex gap-3">
                {!cameraStarted &&
                  !capturedImage && (
                    <button
                      onClick={startCamera}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
                    >
                      Start Camera
                    </button>
                  )}

                {cameraStarted && (
                  <>
                    <button
                      onClick={captureImage}
                      disabled={scanning || !cameraReady}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg transition"
                    >
                      {scanning ? "Scanning..." : cameraReady ? "Capture & Scan" : "Starting camera..."}
                    </button>

                    <button
                      onClick={stopCamera}
                      className="px-5 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                    >
                      Stop
                    </button>
                  </>
                )}

                {capturedImage &&
                  !scanning && (
                    <button
                      onClick={retakeImage}
                      className="flex-1 border border-slate-300 text-slate-700 font-medium py-3 rounded-lg hover:bg-slate-50 transition"
                    >
                      Retake
                    </button>
                  )}
              </div>
            </div>
          </div>

          {/* Vehicle Details */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Vehicle Details
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {isAdminEntry ? "Find and confirm the booking for the vehicle at the gate." : isAdminExit ? "Confirm the detected plate before checkout." : "Verify the detected information before registration."}
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Detected Vehicle Number
              </label>

              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) =>
                  setVehicleNumber(
                    e.target.value.toUpperCase()
                  )
                }
                placeholder="e.g. PB10AB1234"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />

              <p className="text-xs text-slate-500 mt-2">
                {isAdminEntry ? "Correct the plate if needed, then find its reservation." : isAdminExit ? "Correct the detected plate if needed before checkout." : "You can correct the detected number before registering."}
              </p>

              {isAdminExit && (
                <div className="mt-5 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">Manual exit without scanning</h3>
                      <p className="text-xs text-slate-500 mt-1">Select the vehicle from active sessions and confirm it has left.</p>
                    </div>
                    <button onClick={() => API.get("/sessions/admin/active").then((response) => setActiveSessions(response.data.sessions || [])).catch((requestError) => setError(requestError.response?.data?.message || "Could not load active sessions."))} className="text-sm text-blue-700 hover:underline">Refresh</button>
                  </div>
                  {activeSessions.length === 0 ? <p className="mt-3 text-sm text-slate-500">No active sessions found.</p> : (
                    <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                      {activeSessions.map((session) => <div key={session._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                        <div><p className="font-medium text-slate-900">{session.vehicleId?.vehicleNumber || "Unknown plate"}</p><p className="text-xs text-slate-500">{session.parkingLotId?.name} · Slot {session.parkingSlotId?.slotNumber} · Entered {new Date(session.entryTime).toLocaleString()}</p></div>
                        <button onClick={() => completeManualSessionExit(session)} disabled={loading} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">Confirm exit</button>
                      </div>)}
                    </div>
                  )}
                </div>
              )}

              {isAdminExit && (
                <button onClick={completeAdminExit} disabled={loading || scanning || !vehicleNumber.trim()} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium py-3 rounded-lg transition">
                  {loading ? "Checking out..." : "Complete checkout for this plate"}
                </button>
              )}

              {isAdminEntry && (
                <>
                  <button onClick={() => lookupEntryBookings()} disabled={loading || !vehicleNumber.trim()} className="w-full mt-4 px-4 py-3 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                    {loading ? "Searching..." : "Find confirmed booking"}
                  </button>
                  {entryBookings.length > 0 && <div className="mt-5 space-y-3">
                    <h3 className="font-semibold text-slate-900">Confirm the reservation</h3>
                    {entryBookings.map((booking) => (
                      <div key={booking._id} className="rounded-lg border border-slate-200 p-4">
                        <p className="font-medium text-slate-900">{booking.bookingId} · {booking.parkingLotId?.name || "Parking lot"}</p>
                        <p className="text-sm text-slate-600 mt-1">Slot {booking.parkingSlotId?.slotNumber || "-"}, Floor {booking.parkingSlotId?.floor ?? "-"}</p>
                        <p className="text-xs text-slate-500 mt-1">Reserved {new Date(booking.startTime).toLocaleString()} – {new Date(booking.expectedEndTime).toLocaleString()}</p>
                        <button onClick={() => recordAdminEntry(booking._id)} disabled={loading} className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg">Confirm vehicle is at gate & record entry</button>
                      </div>
                    ))}
                  </div>}

                  <form onSubmit={recordWalkInEntry} className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Walk-in entry without a reservation</h3>
                    <p className="mt-1 text-xs text-slate-600">Scan a plate above or type it manually. This creates a live parking session; demo charges are calculated at checkout.</p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm font-medium text-slate-700">Vehicle type
                        <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                          {["CAR", "BIKE", "SUV", "TRUCK", "OTHER"].map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-700">Parking lot
                        <select value={entryLotId} onChange={(event) => { setEntryLotId(event.target.value); setEntrySlotId(""); setEntrySlots([]); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" required>
                          <option value="">Choose a lot</option>
                          {entryLots.map((lot) => <option key={lot._id} value={lot._id}>{lot.name}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-700">Available slot
                        <select value={entrySlotId} onChange={(event) => setEntrySlotId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" required>
                          <option value="">Choose a slot</option>
                          {entrySlots.filter((slot) => slot.status === "AVAILABLE" && slot.vehicleType === vehicleType).map((slot) => <option key={slot._id} value={slot._id}>{slot.slotNumber} · Floor {slot.floor}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-700">Initial parking period
                        <select value={walkInDuration} onChange={(event) => setWalkInDuration(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                          {[30, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                        </select>
                      </label>
                    </div>
                    <button type="submit" disabled={loading || scanning || !vehicleNumber.trim() || !entrySlotId} className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                      {loading ? "Recording entry..." : "Record walk-in entry"}
                    </button>
                  </form>
                </>
              )}

              {!isAdminGate && (
                <>
                  <label className="block text-sm font-medium text-slate-700 mt-6 mb-2">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CAR">Car</option>
                    <option value="BIKE">Bike</option>
                    <option value="SUV">SUV</option>
                    <option value="TRUCK">Truck</option>
                    <option value="OTHER">Other</option>
                  </select>
                </>
              )}

              {!isAdminGate && <button
                onClick={isAdminEntry ? () => lookupEntryBookings() : isAdminExit ? completeAdminExit : registerVehicle}
                disabled={
                  loading ||
                  scanning ||
                  !vehicleNumber.trim()
                }
                className="w-full mt-8 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-lg transition"
              >
                {loading
                  ? "Registering..."
                  : isAdminEntry ? "Find Booking" : isAdminExit ? "Complete Checkout" : "Register Vehicle"}
              </button>}

              <Link
                to={isAdminGate ? "/admin" : "/vehicles"}
                className="block text-center mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                {isAdminGate ? "Back to Admin Dashboard" : "Back to My Vehicles"}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default VehicleScan;
