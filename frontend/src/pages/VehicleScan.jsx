import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

function VehicleScan() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("CAR");

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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar */}

      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <Link
              to="/dashboard"
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
              to="/vehicles"
              className="text-sm font-medium text-slate-600 hover:text-blue-600"
            >
              My Vehicles
            </Link>
          </div>
        </div>
      </nav>

      {/* Main */}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Scan Vehicle
          </h1>

          <p className="mt-2 text-slate-500">
            Capture the vehicle number plate and let
            ParkIt detect the registration number.
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
                Verify the detected information before
                registration.
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
                You can correct the detected number
                before registering.
              </p>

              <label className="block text-sm font-medium text-slate-700 mt-6 mb-2">
                Vehicle Type
              </label>

              <select
                value={vehicleType}
                onChange={(e) =>
                  setVehicleType(e.target.value)
                }
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

              <button
                onClick={registerVehicle}
                disabled={
                  loading ||
                  scanning ||
                  !vehicleNumber.trim()
                }
                className="w-full mt-8 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-lg transition"
              >
                {loading
                  ? "Registering..."
                  : "Register Vehicle"}
              </button>

              <Link
                to="/vehicles"
                className="block text-center mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Back to My Vehicles
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default VehicleScan;
