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
