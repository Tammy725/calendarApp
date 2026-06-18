"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const auth_1 = require("./routes/auth");
const calendar_1 = require("./routes/calendar");
const rooms_1 = require("./routes/rooms");
const availability_1 = require("./routes/availability");
const user_1 = require("./routes/user");
const auth_2 = require("./middleware/auth");
const socket_1 = require("./services/socket");
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express_1.default.json());
app.use('/auth', auth_1.authRouter);
app.use('/calendar', auth_2.authMiddleware, calendar_1.calendarRouter);
app.use('/rooms', rooms_1.roomsRouter);
app.use('/availability', auth_2.authMiddleware, availability_1.availabilityRouter);
app.use('/user', auth_2.authMiddleware, user_1.userRouter);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
(0, socket_1.setupSocketHandlers)(io);
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
process.on('SIGTERM', async () => {
    await exports.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map