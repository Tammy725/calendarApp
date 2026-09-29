"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const index_1 = require("../index");
exports.userRouter = (0, express_1.Router)();
exports.userRouter.get('/me', async (req, res) => {
    const user = await index_1.prisma.user.findUnique({
        where: { id: req.userId },
        include: {
            calendarAccounts: {
                select: { id: true, email: true, provider: true, lastSyncedAt: true },
            },
        },
    });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    res.json(user);
});
exports.userRouter.patch('/me', async (req, res) => {
    const { name, timezone, preferredStartHour, preferredEndHour, bufferMinutes, defaultDurationMinutes, unavailableDays, sleepStartHour, sleepEndHour, } = req.body;
    const user = await index_1.prisma.user.update({
        where: { id: req.userId },
        data: {
            ...(name !== undefined && { name }),
            ...(timezone !== undefined && { timezone }),
            ...(preferredStartHour !== undefined && { preferredStartHour }),
            ...(preferredEndHour !== undefined && { preferredEndHour }),
            ...(bufferMinutes !== undefined && { bufferMinutes }),
            ...(defaultDurationMinutes !== undefined && { defaultDurationMinutes }),
            ...(unavailableDays !== undefined && { unavailableDays }),
            ...(sleepStartHour !== undefined && { sleepStartHour }),
            ...(sleepEndHour !== undefined && { sleepEndHour }),
        },
    });
    res.json(user);
});
exports.userRouter.get('/busy-blocks', async (req, res) => {
    const blocks = await index_1.prisma.busyBlock.findMany({
        where: { userId: req.userId },
        orderBy: { startTime: 'asc' },
        select: { id: true, startTime: true, endTime: true, source: true },
    });
    res.json(blocks);
});
exports.userRouter.post('/busy-blocks', async (req, res) => {
    const { blocks } = req.body;
    if (!Array.isArray(blocks)) {
        return res.status(400).json({ error: 'blocks must be an array' });
    }
    const valid = blocks
        .filter((b) => b && b.start && b.end)
        .map((b) => {
        const start = new Date(b.start);
        const end = new Date(b.end);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start)
            return null;
        return { start, end };
    })
        .filter((b) => b !== null);
    await index_1.prisma.$transaction([
        index_1.prisma.busyBlock.deleteMany({ where: { userId: req.userId } }),
        index_1.prisma.busyBlock.createMany({
            data: valid.map((b) => ({
                userId: req.userId,
                startTime: b.start,
                endTime: b.end,
                source: 'manual',
            })),
        }),
    ]);
    res.json({ saved: valid.length });
});
//# sourceMappingURL=user.js.map