import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function setupSocketHandlers(io: SocketServer) {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    socket.on('join-room', (roomId: string) => {
      socket.join(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('user-joined', { userId: socket.userId });
    });

    socket.on('leave-room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('user-left', { userId: socket.userId });
    });

    socket.on('calendar-updated', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('calendar-sync-requested', {
        userId: socket.userId,
        roomId: data.roomId,
      });
    });

    socket.on('availability-updated', (data: { roomId: string }) => {
      io.to(`room:${data.roomId}`).emit('new-suggestions', {
        userId: socket.userId,
        roomId: data.roomId,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}
