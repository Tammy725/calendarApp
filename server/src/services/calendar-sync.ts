import { google } from 'googleapis';
import { prisma } from '../index';
import { getAuthClient } from './google-auth';

export async function syncCalendar(calendarAccountId: string) {
  const account = await prisma.calendarAccount.findUnique({
    where: { id: calendarAccountId },
  });
  if (!account) throw new Error('Calendar account not found');

  const auth = getAuthClient(account.accessToken, account.refreshToken || undefined);
  const calendar = google.calendar({ version: 'v3', auth });

  let pageToken: string | undefined;
  let synced = 0;

  do {
    const response = await calendar.events.list({
      calendarId: account.calendarId,
      timeMin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      pageToken,
      syncToken: account.syncToken || undefined,
      showDeleted: true,
    });

    const events = response.data.items || [];

    for (const event of events) {
      if (event.status === 'cancelled') {
        await prisma.calendarEvent.deleteMany({
          where: { calendarAccountId, externalId: event.id! },
        });
        continue;
      }

      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      if (!start || !end) continue;

      await prisma.calendarEvent.upsert({
        where: {
          calendarAccountId_externalId: {
            calendarAccountId,
            externalId: event.id!,
          },
        },
        update: {
          title: event.summary || null,
          description: event.description || null,
          startTime: new Date(start),
          endTime: new Date(end),
          isRecurring: !!event.recurrence,
          recurrenceRule: event.recurrence?.join(';') || null,
          timezone: event.start?.timeZone || null,
          isAllDay: !event.start?.dateTime,
          lastModifiedAt: event.updated ? new Date(event.updated) : null,
          etag: event.etag || null,
        },
        create: {
          calendarAccountId,
          externalId: event.id!,
          title: event.summary || null,
          description: event.description || null,
          startTime: new Date(start),
          endTime: new Date(end),
          isRecurring: !!event.recurrence,
          recurrenceRule: event.recurrence?.join(';') || null,
          timezone: event.start?.timeZone || null,
          isAllDay: !event.start?.dateTime,
          lastModifiedAt: event.updated ? new Date(event.updated) : null,
          etag: event.etag || null,
        },
      });
      synced++;
    }

    pageToken = response.data.nextPageToken || undefined;

    if (response.data.nextSyncToken) {
      await prisma.calendarAccount.update({
        where: { id: calendarAccountId },
        data: { syncToken: response.data.nextSyncToken, lastSyncedAt: new Date() },
      });
    }
  } while (pageToken);

  return synced;
}

export async function getEventsForUser(userId: string, from: Date, to: Date) {
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId },
  });

  const events = await prisma.calendarEvent.findMany({
    where: {
      calendarAccountId: { in: accounts.map(a => a.id) },
      startTime: { lt: to },
      endTime: { gt: from },
    },
    orderBy: { startTime: 'asc' },
  });

  return events;
}
