import { Router } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

export const roomsRouter = Router();

roomsRouter.post('/', async (req: AuthRequest, res) => {
  const { name, description, durationMinutes, bufferMinutes, earliestTime, latestTime, dateStart, dateEnd, timezone } = req.body;

  const room = await prisma.schedulingRoom.create({
    data: {
      name,
      description,
      durationMinutes: durationMinutes ?? 60,
      bufferMinutes: bufferMinutes ?? 15,
      earliestTime: earliestTime ?? 8,
      latestTime: latestTime ?? 20,
      dateStart: dateStart ? new Date(dateStart) : null,
      dateEnd: dateEnd ? new Date(dateEnd) : null,
      timezone: timezone ?? 'UTC',
      createdById: req.userId!,
      participants: {
        create: {
          userId: req.userId!,
          role: 'owner',
          status: 'ACCEPTED',
        },
      },
    },
    include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } } },
  });

  res.status(201).json(room);
});

roomsRouter.get('/', async (req: AuthRequest, res) => {
  const rooms = await prisma.schedulingRoom.findMany({
    where: {
      participants: { some: { userId: req.userId! } },
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

roomsRouter.get('/:id', async (req: AuthRequest, res) => {
  const roomId = req.params.id as string;
  const room = await prisma.schedulingRoom.findUnique({
    where: { id: roomId },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      participants: {
        include: { user: { select: { id: true, name: true, email: true, avatar: true, timezone: true } } },
      },
      suggestions: { orderBy: { score: 'desc' }, take: 10 },
    },
  });

  if (!room) return res.status(404).json({ error: 'Room not found' });

  const isMember = room.participants.some((p: { userId: string }) => p.userId === req.userId!);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  res.json(room);
});

roomsRouter.patch('/:id', async (req: AuthRequest, res) => {
  const roomId = req.params.id as string;
  const room = await prisma.schedulingRoom.findFirst({
    where: { id: roomId, createdById: req.userId! },
  });
  if (!room) return res.status(404).json({ error: 'Room not found or not owner' });

  const { name, description, durationMinutes, earliestTime, latestTime, dateStart, dateEnd, status } = req.body;

  const updated = await prisma.schedulingRoom.update({
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

roomsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const roomId = req.params.id as string;
  const room = await prisma.schedulingRoom.findFirst({
    where: { id: roomId, createdById: req.userId! },
  });
  if (!room) return res.status(404).json({ error: 'Room not found or not owner' });

  await prisma.schedulingRoom.delete({ where: { id: roomId } });
  res.json({ message: 'Room deleted' });
});

roomsRouter.post('/:id/invite', async (req: AuthRequest, res) => {
  const roomId = req.params.id as string;
  const { email } = req.body;
  const room = await prisma.schedulingRoom.findFirst({
    where: { id: roomId, createdById: req.userId! },
  });
  if (!room) return res.status(404).json({ error: 'Room not found or not owner' });

  const invitedUser = await prisma.user.findUnique({ where: { email } });
  if (!invitedUser) return res.status(404).json({ error: 'User not found' });

  const existing = await prisma.roomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId: invitedUser.id } },
  });
  if (existing) return res.status(409).json({ error: 'User already invited' });

  const participant = await prisma.roomParticipant.create({
    data: { roomId, userId: invitedUser.id, role: 'member', status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

  res.status(201).json(participant);
});

roomsRouter.post('/:id/join', async (req: AuthRequest, res) => {
  const roomId = req.params.id as string;
  const room = await prisma.schedulingRoom.findUnique({ where: { id: roomId } });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const existing = await prisma.roomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId: req.userId! } },
  });

  if (existing) {
    if (existing.status === 'PENDING') {
      await prisma.roomParticipant.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED' },
      });
    }
    return res.json(existing);
  }

  const participant = await prisma.roomParticipant.create({
    data: { roomId, userId: req.userId!, status: 'ACCEPTED' },
  });

  res.status(201).json(participant);
});

roomsRouter.delete('/:id/leave', async (req: AuthRequest, res) => {
  const roomId = req.params.id as string;
  const participant = await prisma.roomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId: req.userId! } },
  });
  if (!participant) return res.status(404).json({ error: 'Not a member' });

  await prisma.roomParticipant.delete({ where: { id: participant.id } });
  res.json({ message: 'Left room' });
});
