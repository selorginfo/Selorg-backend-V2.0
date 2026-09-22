import { io, type Socket } from "socket.io-client";
import { getToken } from "./session";
import { resolveApiBaseUrl } from "./api";

let socket: Socket | null = null;

/** Opens (or reuses) a Socket.IO connection using the customer JWT. */
export function getSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }
  socket = io(resolveApiBaseUrl(), {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
