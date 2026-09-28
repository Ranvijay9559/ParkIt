import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

function AdminDashboard() {
  const navigate = useNavigate();

  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await API.get("/parking/lots");

        setLots(response.data.parkingLots || []);
      } catch (error) {
        console.error("Admin dashboard error:", error);

        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
          return;
        }

        if (error.response?.status === 403) {
          setError("You do not have admin access.");
          return;
        }

        setError(
          error.response?.data?.message ||
            "Failed to load admin dashboard."
        );
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  const totalLots = lots.length;

  const totalSlots = lots.reduce(
    (total, lot) => total + (lot.totalSlots || 0),
    0
  );

  const availableSlots = lots.reduce(
    (total, lot) => total + (lot.availableSlots || 0),
    0
  );

  const occupiedSlots =
    totalSlots - availableSlots;

  const occupancyPercentage =
    totalSlots > 0
      ? Math.round(
          (occupiedSlots / totalSlots) * 100
        )
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-slate-600">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

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

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Admin Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Monitor and manage ParkIt parking operations.
          </p>
        </div>

        {/* Error */}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Statistics */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Parking Lots */}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Parking Lots
            </p>

            <div className="flex items-end justify-between mt-2">
              <p className="text-3xl font-bold text-slate-900">
                {totalLots}
              </p>

              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                L
              </div>
            </div>
          </div>

          {/* Total Slots */}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Slots
            </p>

            <div className="flex items-end justify-between mt-2">
              <p className="text-3xl font-bold text-slate-900">
                {totalSlots}
              </p>

              <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold">
                S
              </div>
            </div>
          </div>

          {/* Available */}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Available Slots
            </p>

            <div className="flex items-end justify-between mt-2">
              <p className="text-3xl font-bold text-green-600">
                {availableSlots}
              </p>

              <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600 font-bold">
                ✓
              </div>
            </div>
          </div>

          {/* Occupied */}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Occupied Slots
            </p>

            <div className="flex items-end justify-between mt-2">
              <p className="text-3xl font-bold text-orange-600">
                {occupiedSlots}
              </p>

              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 font-bold">
                O
              </div>
            </div>
          </div>
        </div>

        {/* Occupancy */}

        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Overall Occupancy
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Current parking utilization
              </p>
            </div>

            <span className="text-2xl font-bold text-blue-600">
              {occupancyPercentage}%
            </span>
          </div>

          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{
                width: `${occupancyPercentage}%`
              }}
            ></div>
          </div>

          <div className="flex justify-between mt-3 text-sm text-slate-500">
            <span>
              {occupiedSlots} occupied
            </span>

            <span>
              {availableSlots} available
            </span>
          </div>
        </div>

        {/* Parking Lots */}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Parking Locations
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Current status of all parking lots
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/admin/parking" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Manage parking</Link>
              <Link to="/admin/pricing" className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50">Manage pricing</Link>
            </div>
          </div>

          {lots.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">
                🅿️
              </div>

              <h3 className="text-lg font-semibold text-slate-900">
                No parking lots found
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Create your first parking lot to start
                managing ParkIt.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lots.map((lot) => {
                const lotOccupancy =
                  lot.totalSlots > 0
                    ? Math.round(
                        ((lot.totalSlots -
                          lot.availableSlots) /
                          lot.totalSlots) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={lot._id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-slate-900">
                          {lot.name}
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
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

                    <div className="grid grid-cols-3 gap-3 mt-6">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500">
                          Total
                        </p>

                        <p className="text-lg font-bold text-slate-900 mt-1">
                          {lot.totalSlots}
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500">
                          Free
                        </p>

                        <p className="text-lg font-bold text-green-600 mt-1">
                          {lot.availableSlots}
                        </p>
                      </div>

                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500">
                          Used
                        </p>

                        <p className="text-lg font-bold text-orange-600 mt-1">
                          {lot.totalSlots -
                            lot.availableSlots}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-xs text-slate-500 mb-2">
                        <span>
                          Occupancy
                        </span>

                        <span>
                          {lotOccupancy}%
                        </span>
                      </div>

                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{
                            width: `${lotOccupancy}%`
                          }}
                        ></div>
                      </div>
                    </div>

                    <Link
                      to={`/parking`}
                      className="block text-center mt-5 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      View Slots
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
