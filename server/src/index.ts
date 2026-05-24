import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { authRouter } from './routes/auth';
import { calendarRouter } from './routes/calendar';
import { roomsRouter } from './routes/rooms';
import { availabilityRouter } from './routes/availability';
import { userRouter } from './routes/user';
import { authMiddleware } from './middleware/auth';
import { setupSocketHandlers } from './services/socket';

export const prisma = new PrismaClient();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/calendar', authMiddleware, calendarRouter);
app.use('/api/rooms', authMiddleware, roomsRouter);
app.use('/api/availability', authMiddleware, availabilityRouter);
app.use('/api/user', authMiddleware, userRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
