import { Navigate, Outlet } from "react-router-dom";

function RoleRoute({ roles }) {
  const token = localStorage.getItem("token");
  const role = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")?.role || null;
    } catch {
      return null;
    }
  })();

  if (!token || !role) return <Navigate to="/" replace />;
  if (roles && !roles.includes(role)) return <Navigate to={role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  return <Outlet />;
}

export default RoleRoute;
