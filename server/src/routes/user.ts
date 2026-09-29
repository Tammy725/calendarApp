import { Router } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

export const userRouter = Router();

userRouter.get('/me', async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: {
      calendarAccounts: {
        select: { id: true, email: true, provider: true, lastSyncedAt: true },
      },
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

userRouter.patch('/me', async (req: AuthRequest, res) => {
  const {
    name, timezone, preferredStartHour, preferredEndHour,
    bufferMinutes, defaultDurationMinutes, unavailableDays,
    sleepStartHour, sleepEndHour,
  } = req.body;

  const user = await prisma.user.update({
    where: { id: req.userId! },
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

userRouter.get('/busy-blocks', async (req: AuthRequest, res) => {
  const blocks = await prisma.busyBlock.findMany({
    where: { userId: req.userId! },
    orderBy: { startTime: 'asc' },
    select: { id: true, startTime: true, endTime: true, source: true },
  });
  res.json(blocks);
});

userRouter.post('/busy-blocks', async (req: AuthRequest, res) => {
  const { blocks } = req.body;

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ error: 'blocks must be an array' });
  }

  const valid = blocks
    .filter((b: any) => b && b.start && b.end)
    .map((b: any) => {
      const start = new Date(b.start);
      const end = new Date(b.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
      return { start, end };
    })
    .filter((b: { start: Date; end: Date } | null): b is { start: Date; end: Date } => b !== null);

  await prisma.$transaction([
    prisma.busyBlock.deleteMany({ where: { userId: req.userId! } }),
    prisma.busyBlock.createMany({
      data: valid.map((b) => ({
        userId: req.userId!,
        startTime: b.start,
        endTime: b.end,
        source: 'manual',
      })),
    }),
  ]);

  res.json({ saved: valid.length });
});
