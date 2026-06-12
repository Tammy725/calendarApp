import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './stores/auth-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket | null {
  if (socket?.connected) return socket;
  const token = useAuthStore.getState().token;
  if (!token) return null;
  socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('connect_error', (err) => console.log('Socket error:', err.message));
  return socket;
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
