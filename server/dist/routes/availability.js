"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityRouter = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const supabase_1 = require("../lib/supabase");
const availability_engine_1 = require("../services/availability-engine");
exports.availabilityRouter = (0, express_1.Router)();
exports.availabilityRouter.post("/compute/:roomId", async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const room = await index_1.prisma.schedulingRoom.findUnique({
            where: { id: roomId },
            include: {
                participants: {
                    where: { userId: req.userId },
                },
            },
        });
        if (!room || room.participants.length === 0) {
            return res.status(404).json({ error: "Room not found or not a member" });
        }
        const results = await (0, availability_engine_1.computeAvailability)(roomId);
        const top = results
            .filter((r) => r.score > 0)
            .slice(0, 20)
            .map((r) => ({
            start: r.slot.start,
            end: r.slot.end,
            score: r.score,
            availableCount: r.availableUserIds.length,
            totalCount: r.totalUsers,
            availableUserIds: r.availableUserIds,
        }));
        res.json({ suggestions: top, total: results.length });
    }
    catch (error) {
        console.error("Availability compute error:", error);
        res.status(500).json({ error: "Failed to compute availability" });
    }
});
exports.availabilityRouter.get("/suggestions/:roomId", async (req, res) => {
    const suggestions = await index_1.prisma.suggestion.findMany({
        where: { roomId: req.params.roomId },
        orderBy: { score: "desc" },
        take: 50,
    });
    res.json(suggestions);
});
exports.availabilityRouter.get("/stats/:roomId", async (req, res) => {
    const stats = await (0, availability_engine_1.getRoomStats)(req.params.roomId);
    if (!stats)
        return res.status(404).json({ error: "No availability data" });
    res.json(stats);
});
async function loadCheckEntries(roomId) {
    const room = await index_1.prisma.schedulingRoom.findUnique({
        where: { id: roomId },
        include: {
            participants: {
                where: { status: "ACCEPTED" },
                include: {
                    user: {
                        include: {
                            busyBlocks: true,
                            calendarAccounts: {
                                include: {
                                    events: {
                                        where: {
                                            isAllDay: false,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (room) {
        return room.participants.map((p) => {
            if (!p.user) {
                return {
                    userId: p.guestName || `guest-${p.id}`,
                    name: p.guestName || "Invitado",
                    user: null,
                };
            }
            return {
                userId: p.user.id,
                name: p.user.name || p.user.email,
                user: p.user,
            };
        });
    }
    // Fallback: the plan may live in Supabase (rooms keyed by invitation code)
    const supabaseRoom = await (0, supabase_1.fetchRoomAndParticipants)(roomId);
    if (!supabaseRoom)
        return null;
    const entries = [];
    for (const participant of supabaseRoom.participants) {
        if (participant.user_id) {
            const user = await index_1.prisma.user.findUnique({
                where: { id: participant.user_id },
                include: {
                    busyBlocks: true,
                    calendarAccounts: {
                        include: {
                            events: {
                                where: {
                                    isAllDay: false,
                                },
                            },
                        },
                    },
                },
            });
            entries.push(user
                ? {
                    userId: user.id,
                    name: user.name || user.email,
                    user: user,
                }
                : {
                    userId: participant.user_id,
                    name: participant.guest_name || "Invitado",
                    user: null,
                });
        }
        else {
            entries.push({
                userId: participant.id,
                name: participant.guest_name || "Invitado",
                user: null,
            });
        }
    }
    return entries;
}
function isEntryFree(entry, checkFrom, checkTo) {
    if (!entry.user)
        return true; // Guest participant without a user account → assume free
    for (const block of entry.user.busyBlocks) {
        const bStart = new Date(block.startTime);
        const bEnd = new Date(block.endTime);
        if (bStart < checkTo && bEnd > checkFrom)
            return false;
    }
    for (const account of entry.user.calendarAccounts) {
        for (const event of account.events) {
            const eStart = new Date(event.startTime);
            const eEnd = new Date(event.endTime);
            if (eStart < checkTo && eEnd > checkFrom)
                return false;
        }
    }
    return true;
}
exports.availabilityRouter.post("/check/:roomId", async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const { dayOfWeek, startHour, endHour, from, to } = req.body;
        const entries = await loadCheckEntries(roomId);
        if (!entries)
            return res.status(404).json({ error: "Room not found" });
        let checkFrom;
        let checkTo;
        let targetDate;
        if (from && to) {
            // Absolute timestamps computed on the client (device-local timezone)
            checkFrom = new Date(from);
            checkTo = new Date(to);
            if (isNaN(checkFrom.getTime()) || isNaN(checkTo.getTime()) || checkTo <= checkFrom) {
                return res.status(400).json({ error: "Invalid time range" });
            }
            targetDate = new Date(checkFrom);
            targetDate.setHours(0, 0, 0, 0);
        }
        else {
            const now = new Date();
            const dayDiff = (dayOfWeek - now.getDay() + 7) % 7;
            targetDate = new Date(now);
            targetDate.setDate(now.getDate() + (dayDiff === 0 ? 7 : dayDiff));
            targetDate.setHours(0, 0, 0, 0);
            checkFrom = new Date(targetDate);
            checkFrom.setHours(startHour, 0, 0, 0);
            checkTo = new Date(targetDate);
            checkTo.setHours(endHour, 0, 0, 0);
        }
        const results = entries.map((entry) => {
            const free = isEntryFree(entry, checkFrom, checkTo);
            return {
                userId: entry.userId,
                name: entry.name,
                free,
            };
        });
        res.json({
            dayOfWeek,
            date: targetDate.toISOString(),
            from: checkFrom.toISOString(),
            to: checkTo.toISOString(),
            results,
            allFree: results.every((r) => r.free),
            totalParticipants: results.length,
        });
    }
    catch (error) {
        console.error("Check error:", error);
        res.status(500).json({ error: "Failed to check availability" });
    }
});
exports.availabilityRouter.post("/slots/:roomId", async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const { from, to, slotMinutes } = req.body;
        if (!from || !to) {
            return res.status(400).json({ error: "from and to are required" });
        }
        const checkFrom = new Date(from);
        const checkTo = new Date(to);
        if (isNaN(checkFrom.getTime()) || isNaN(checkTo.getTime()) || checkTo <= checkFrom) {
            return res.status(400).json({ error: "Invalid time range" });
        }
        const entries = await loadCheckEntries(roomId);
        if (!entries)
            return res.status(404).json({ error: "Room not found" });
        const stepMs = (slotMinutes || 60) * 60 * 1000;
        const slots = [];
        let start = new Date(checkFrom);
        while (start.getTime() < checkTo.getTime()) {
            const end = new Date(Math.min(start.getTime() + stepMs, checkTo.getTime()));
            const row = entries.map((entry) => ({
                userId: entry.userId,
                name: entry.name,
                free: isEntryFree(entry, start, end),
            }));
            const freeCount = row.filter((r) => r.free).length;
            slots.push({
                start: start.toISOString(),
                end: end.toISOString(),
                freeCount,
                total: row.length,
                participants: row,
            });
            start = new Date(end);
        }
        res.json({
            from: checkFrom.toISOString(),
            to: checkTo.toISOString(),
            slotMinutes: stepMs / 60000,
            slots,
            totalParticipants: entries.length,
        });
    }
    catch (error) {
        console.error("Slots error:", error);
        res.status(500).json({ error: "Failed to compute availability slots" });
    }
});
exports.availabilityRouter.post("/finalize/:roomId", async (req, res) => {
    const { suggestionId } = req.body;
    const roomId = req.params.roomId;
    const room = await index_1.prisma.schedulingRoom.findFirst({
        where: { id: roomId, createdById: req.userId },
    });
    if (!room)
        return res.status(404).json({ error: "Room not found or not owner" });
    await index_1.prisma.schedulingRoom.update({
        where: { id: roomId },
        data: { status: "FINALIZED" },
    });
    res.json({ message: "Time finalized" });
});
//# sourceMappingURL=availability.js.map