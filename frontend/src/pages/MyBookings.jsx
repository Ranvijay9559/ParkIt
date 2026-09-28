import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    let active = true;
    API.get("/bookings")
      .then((response) => { if (active) setBookings(response.data.bookings || []); })
      .catch((error) => {
        if (active) setError(error.response?.data?.message || "Failed to load bookings");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/bookings");

      setBookings(response.data.bookings || []);
    } catch (error) {
      console.error("Failed to load bookings:", error);

      setError(
        error.response?.data?.message ||
          "Failed to load bookings"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setCancellingId(bookingId);
      setError("");

      await API.patch(
        `/bookings/${bookingId}/cancel`
      );

      await loadBookings();
    } catch (error) {
      console.error("Cancellation failed:", error);

      setError(
        error.response?.data?.message ||
          "Failed to cancel booking"
      );
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-blue-100 text-blue-700";

      case "ACTIVE":
        return "bg-green-100 text-green-700";

      case "COMPLETED":
        return "bg-slate-100 text-slate-700";

      case "CANCELLED":
        return "bg-red-100 text-red-700";

      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">

          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-slate-600">
            Loading your bookings...
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

            <div className="flex items-center gap-5">

              <Link
                to="/booking"
                className="hidden sm:block text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Book Parking
              </Link>

              <Link
                to="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-blue-600"
              >
                ← Dashboard
              </Link>

            </div>

          </div>

        </div>

      </nav>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">

          <div>

            <h1 className="text-3xl font-bold text-slate-900">
              My Bookings
            </h1>

            <p className="mt-2 text-slate-500">
              View and manage your parking bookings.
            </p>

          </div>

          <Link
            to="/booking"
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          >
            + New Booking
          </Link>

        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* No bookings */}
        {bookings.length === 0 ? (

          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">

            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-600 text-xl">
              B
            </div>

            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              No bookings yet
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              You haven't made any parking bookings yet.
            </p>

            <Link
              to="/booking"
              className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              Book a Parking Slot
            </Link>

          </div>

        ) : (

          <div className="space-y-5">

            {bookings.map((booking) => (

              <div
                key={booking._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >

                {/* Booking Header */}
                <div className="px-6 py-5 border-b border-slate-200">

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                    <div>

                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Booking ID
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        {booking.bookingId}
                      </p>

                    </div>

                    <span
                      className={`inline-flex w-fit px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>

                  </div>

                </div>

                {/* Booking Details */}
                <div className="p-6">

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                    {/* Vehicle */}
                    <div>

                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Vehicle
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {booking.vehicleId?.vehicleNumber ||
                          "-"}
                      </p>

                      <p className="text-sm text-slate-500">
                        {booking.vehicleId?.vehicleType ||
                          "-"}
                      </p>

                    </div>

                    {/* Parking */}
                    <div>

                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Parking Location
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {booking.parkingLotId?.name ||
                          "-"}
                      </p>

                      <p className="text-sm text-slate-500">
                        {booking.parkingLotId?.location ||
                          "-"}
                      </p>

                    </div>

                    {/* Slot */}
                    <div>

                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Parking Slot
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {booking.parkingSlotId?.slotNumber ||
                          "-"}
                      </p>

                      <p className="text-sm text-slate-500">
                        {booking.parkingSlotId?.floor
                          ? `Floor ${booking.parkingSlotId.floor}`
                          : ""}
                      </p>

                    </div>

                    {/* Type */}
                    <div>

                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Booking Type
                      </p>

                      <p className="mt-2 font-semibold text-slate-900">
                        {booking.bookingType ||
                          "ONLINE"}
                      </p>

                    </div>

                  </div>

                  {/* Timing */}
                  <div className="mt-6 pt-6 border-t border-slate-100">

                    <h3 className="text-sm font-semibold text-slate-900">
                      Parking Schedule
                    </h3>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

                      <div>
                        <p className="text-xs text-slate-500">
                          Start Time
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {formatDate(booking.startTime)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Expected End
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {formatDate(
                            booking.expectedEndTime
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Actual Entry
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {formatDate(
                            booking.actualEntryTime
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Actual Exit
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {formatDate(
                            booking.actualExitTime
                          )}
                        </p>
                      </div>

                    </div>

                  </div>

                  {/* Amount */}
                  {(booking.status === "COMPLETED" ||
                    booking.totalAmount > 0) && (

                    <div className="mt-6 pt-6 border-t border-slate-100">

                      <h3 className="text-sm font-semibold text-slate-900">
                        Parking Charges
                      </h3>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">

                        <div className="bg-slate-50 rounded-lg p-4">

                          <p className="text-xs text-slate-500">
                            Base Amount
                          </p>

                          <p className="mt-1 text-lg font-bold text-slate-900">
                            ₹{booking.baseAmount || 0}
                          </p>

                        </div>

                        <div className="bg-slate-50 rounded-lg p-4">

                          <p className="text-xs text-slate-500">
                            Extra Amount
                          </p>

                          <p className="mt-1 text-lg font-bold text-slate-900">
                            ₹{booking.extraAmount || 0}
                          </p>

                        </div>

                        <div className="bg-blue-50 rounded-lg p-4">

                          <p className="text-xs text-blue-600">
                            Total Amount
                          </p>

                          <p className="mt-1 text-lg font-bold text-blue-700">
                            ₹{booking.totalAmount || 0}
                          </p>

                        </div>

                      </div>

                    </div>

                  )}

                  {/* Actions */}
                  <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-3">

                    {booking.status === "CONFIRMED" && (
                      <button
                        onClick={() =>
                          handleCancel(booking._id)
                        }
                        disabled={
                          cancellingId === booking._id
                        }
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
                      >
                        {cancellingId === booking._id
                          ? "Cancelling..."
                          : "Cancel Booking"}
                      </button>
                    )}

                    {booking.status === "ACTIVE" && (
                      <span className="px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                        Parking Session Active
                      </span>
                    )}

                    {booking.status === "COMPLETED" && (
                      <span className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium">
                        Parking Completed
                      </span>
                    )}

                    {booking.status === "CANCELLED" && (
                      <span className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
                        Booking Cancelled
                      </span>
                    )}

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </main>

    </div>
  );
}

export default MyBookings;
