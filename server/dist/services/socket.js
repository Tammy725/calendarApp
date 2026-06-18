"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function setupSocketHandlers(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.userId = payload.userId;
            next();
        }
        catch {
            next(new Error('Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);
        socket.on('join-room', (roomId) => {
            socket.join(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit('user-joined', { userId: socket.userId });
        });
        socket.on('leave-room', (roomId) => {
            socket.leave(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit('user-left', { userId: socket.userId });
        });
        socket.on('calendar-updated', (data) => {
            socket.to(`room:${data.roomId}`).emit('calendar-sync-requested', {
                userId: socket.userId,
                roomId: data.roomId,
            });
        });
        socket.on('availability-updated', (data) => {
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
//# sourceMappingURL=socket.js.map