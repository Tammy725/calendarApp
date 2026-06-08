import { Router } from 'express';
import { google } from 'googleapis';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { syncCalendar } from '../services/calendar-sync';
import { getAuthClient } from '../services/google-auth';

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

calendarRouter.post('/events/create', async (req: AuthRequest, res) => {
  try {
    const { title, description, startTime, endTime, timeZone } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'title, startTime, and endTime are required' });
    }

    const account = await prisma.calendarAccount.findFirst({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'asc' },
    });
    if (!account) return res.status(400).json({ error: 'No calendar connected' });

    const auth = getAuthClient(account.accessToken, account.refreshToken || undefined);
    const calendar = google.calendar({ version: 'v3', auth });

    const event = await calendar.events.insert({
      calendarId: account.calendarId,
      requestBody: {
        summary: title,
        description: description || '',
        start: { dateTime: startTime, timeZone: timeZone || 'UTC' },
        end: { dateTime: endTime, timeZone: timeZone || 'UTC' },
        reminders: { useDefault: true },
      },
    });

    res.json({ event: event.data, htmlLink: event.data.htmlLink });
  } catch (error: any) {
    console.error('Create event error:', error);
    res.status(500).json({ error: error?.message || 'Failed to create event' });
  }
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
