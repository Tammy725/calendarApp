import { Router } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { syncCalendar } from '../services/calendar-sync';

export const calendarRouter = Router();

calendarRouter.get('/', async (req: AuthRequest, res) => {
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: req.userId! },
    select: { id: true, email: true, provider: true, lastSyncedAt: true, calendarId: true },
  });
  res.json(accounts);
});

calendarRouter.post('/sync', async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.body;
    const account = await prisma.calendarAccount.findFirst({
      where: { id: accountId, userId: req.userId! },
    });
    if (!account) return res.status(404).json({ error: 'Calendar account not found' });

    const count = await syncCalendar(accountId);
    res.json({ synced: count, message: `Synced ${count} events` });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

calendarRouter.post('/sync-all', async (req: AuthRequest, res) => {
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: req.userId! },
  });

  const results = await Promise.allSettled(
    accounts.map(a => syncCalendar(a.id).catch(e => {
      console.error(`Failed to sync ${a.email}:`, e);
      return 0;
    })),
  );

  const total = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
  res.json({ synced: total, accounts: accounts.length });
});

calendarRouter.get('/events', async (req: AuthRequest, res) => {
  const { from, to } = req.query;
  const fromDate = from ? new Date(from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: req.userId! },
    select: { id: true },
  });

  const events = await prisma.calendarEvent.findMany({
    where: {
      calendarAccountId: { in: accounts.map(a => a.id) },
      startTime: { lt: toDate },
      endTime: { gt: fromDate },
    },
    orderBy: { startTime: 'asc' },
  });

  res.json(events);
});

calendarRouter.delete('/:id', async (req: AuthRequest, res) => {
  const accountId = req.params.id as string;
  const account = await prisma.calendarAccount.findFirst({
    where: { id: accountId, userId: req.userId! },
  });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  await prisma.calendarEvent.deleteMany({ where: { calendarAccountId: account.id } });
  await prisma.calendarAccount.delete({ where: { id: account.id } });

  res.json({ message: 'Calendar disconnected' });
});
