import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './stores/auth-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket | null {
  return null;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinRoom(roomId: string) {
  const s = connectSocket();
  if (s?.connected) s.emit('join-room', roomId);
}

export function leaveRoom(roomId: string) {
  const s = getSocket();
  if (s?.connected) s.emit('leave-room', roomId);
}
