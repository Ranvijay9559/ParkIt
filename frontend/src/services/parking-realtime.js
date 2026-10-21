import { io } from "socket.io-client";
import API from "../api/axios";

export function subscribeToParkingUpdates(handler) {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL;
  const isLocalFrontend = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // Vercel's serverless Express deployment does not host a persistent
  // Socket.IO server. Use polling there, unless a dedicated socket URL exists.
  if (!configuredUrl && !isLocalFrontend) return () => {};

  const socketUrl = configuredUrl || (API.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
  const socket = io(socketUrl, { reconnection: true, timeout: 4000 });
  socket.on("parking:availability", handler);

  return () => {
    socket.off("parking:availability", handler);
    socket.disconnect();
  };
}
