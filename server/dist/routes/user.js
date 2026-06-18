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
//# sourceMappingURL=user.js.map