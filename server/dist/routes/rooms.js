"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = void 0;
const express_1 = require("express");
const index_1 = require("../index");
exports.roomsRouter = (0, express_1.Router)();
exports.roomsRouter.post('/', async (req, res) => {
    try {
        const { code, name, description, durationMinutes, bufferMinutes, earliestTime, latestTime, dateStart, dateEnd, maxParticipants, timezone } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Name is required' });
        const data = {
            ...(code && { id: code }),
            name,
            description,
            durationMinutes: durationMinutes ?? 60,
            bufferMinutes: bufferMinutes ?? 15,
            earliestTime: earliestTime ?? 8,
            latestTime: latestTime ?? 20,
            dateStart: dateStart ? new Date(dateStart) : null,
            dateEnd: dateEnd ? new Date(dateEnd) : null,
            maxParticipants: maxParticipants ?? 2,
            timezone: timezone ?? 'UTC',
            ...(req.userId && { createdById: req.userId }),
        };
        if (req.userId) {
            data.participants = {
                create: {
                    userId: req.userId,
                    role: 'owner',
                    status: 'ACCEPTED',
                },
            };
        }
        const room = await index_1.prisma.schedulingRoom.create({
            data,
            include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } } },
        });
        res.status(201).json(room);
    }
    catch (e) {
        if (e?.code === 'P2002') {
            return res.status(409).json({ error: 'Room code already exists' });
        }
        console.error('[rooms] create error:', e);
        res.status(500).json({ error: 'Failed to create room' });
    }
});
exports.roomsRouter.get('/', async (req, res) => {
    if (!req.userId)
        return res.json([]);
    const rooms = await index_1.prisma.schedulingRoom.findMany({
        where: {
            participants: { some: { userId: req.userId } },
        },
        include: {
            createdBy: { select: { id: true, name: true, email: true } },
            participants: {
                include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            },
            _count: { select: { suggestions: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });
    res.json(rooms);
});
exports.roomsRouter.get('/:id', async (req, res) => {
    const roomId = req.params.id;
    const room = await index_1.prisma.schedulingRoom.findUnique({
        where: { id: roomId },
        include: {
            createdBy: { select: { id: true, name: true, email: true, avatar: true } },
            participants: {
                include: { user: { select: { id: true, name: true, email: true, avatar: true, timezone: true } } },
            },
            suggestions: { orderBy: { score: 'desc' }, take: 10 },
        },
    });
    if (!room)
        return res.status(404).json({ error: 'Room not found' });
    res.json(room);
});
exports.roomsRouter.patch('/:id', async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: 'Authentication required' });
    const roomId = req.params.id;
    const room = await index_1.prisma.schedulingRoom.findFirst({
        where: { id: roomId, createdById: req.userId },
    });
    if (!room)
        return res.status(404).json({ error: 'Room not found or not owner' });
    const { name, description, durationMinutes, earliestTime, latestTime, dateStart, dateEnd, status } = req.body;
    const updated = await index_1.prisma.schedulingRoom.update({
        where: { id: roomId },
        data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(durationMinutes !== undefined && { durationMinutes }),
            ...(earliestTime !== undefined && { earliestTime }),
            ...(latestTime !== undefined && { latestTime }),
            ...(dateStart !== undefined && { dateStart: dateStart ? new Date(dateStart) : null }),
            ...(dateEnd !== undefined && { dateEnd: dateEnd ? new Date(dateEnd) : null }),
            ...(status !== undefined && { status }),
        },
    });
    res.json(updated);
});
exports.roomsRouter.delete('/:id', async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: 'Authentication required' });
    const roomId = req.params.id;
    const room = await index_1.prisma.schedulingRoom.findFirst({
        where: { id: roomId, createdById: req.userId },
    });
    if (!room)
        return res.status(404).json({ error: 'Room not found or not owner' });
    await index_1.prisma.schedulingRoom.delete({ where: { id: roomId } });
    res.json({ message: 'Room deleted' });
});
exports.roomsRouter.post('/:id/invite', async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: 'Authentication required' });
    const roomId = req.params.id;
    const { email } = req.body;
    const room = await index_1.prisma.schedulingRoom.findFirst({
        where: { id: roomId, createdById: req.userId },
    });
    if (!room)
        return res.status(404).json({ error: 'Room not found or not owner' });
    const invitedUser = await index_1.prisma.user.findUnique({ where: { email } });
    if (!invitedUser)
        return res.status(404).json({ error: 'User not found' });
    const existing = await index_1.prisma.roomParticipant.findUnique({
        where: { roomId_userId: { roomId, userId: invitedUser.id } },
    });
    if (existing)
        return res.status(409).json({ error: 'User already invited' });
    const participant = await index_1.prisma.roomParticipant.create({
        data: { roomId, userId: invitedUser.id, role: 'member', status: 'PENDING' },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
    res.status(201).json(participant);
});
const roomWithParticipantsInclude = {
    createdBy: { select: { id: true, name: true, email: true, avatar: true } },
    participants: {
        include: { user: { select: { id: true, name: true, email: true, avatar: true, timezone: true } } },
    },
};
exports.roomsRouter.post('/:id/join', async (req, res) => {
    const roomId = req.params.id;
    const { name } = req.body;
    const room = await index_1.prisma.schedulingRoom.findUnique({ where: { id: roomId } });
    if (!room)
        return res.status(404).json({ error: 'Room not found' });
    if (req.userId) {
        const existing = await index_1.prisma.roomParticipant.findUnique({
            where: { roomId_userId: { roomId, userId: req.userId } },
        });
        if (existing) {
            if (existing.status === 'PENDING') {
                await index_1.prisma.roomParticipant.update({
                    where: { id: existing.id },
                    data: { status: 'ACCEPTED' },
                });
            }
        }
        else {
            await index_1.prisma.roomParticipant.create({
                data: { roomId, userId: req.userId, status: 'ACCEPTED' },
            });
        }
    }
    else {
        if (!name)
            return res.status(400).json({ error: 'Name is required for anonymous join' });
        const existingGuest = await index_1.prisma.roomParticipant.findFirst({
            where: { roomId, guestName: name, userId: null },
        });
        if (!existingGuest) {
            await index_1.prisma.roomParticipant.create({
                data: { roomId, guestName: name, status: 'ACCEPTED' },
            });
        }
    }
    const updatedRoom = await index_1.prisma.schedulingRoom.findUnique({
        where: { id: roomId },
        include: roomWithParticipantsInclude,
    });
    res.json(updatedRoom);
});
exports.roomsRouter.delete('/:id/leave', async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: 'Authentication required' });
    const roomId = req.params.id;
    const participant = await index_1.prisma.roomParticipant.findUnique({
        where: { roomId_userId: { roomId, userId: req.userId } },
    });
    if (!participant)
        return res.status(404).json({ error: 'Not a member' });
    await index_1.prisma.roomParticipant.delete({ where: { id: participant.id } });
    res.json({ message: 'Left room' });
});
//# sourceMappingURL=rooms.js.map