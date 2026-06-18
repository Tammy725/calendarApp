"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCalendar = syncCalendar;
exports.getEventsForUser = getEventsForUser;
const googleapis_1 = require("googleapis");
const index_1 = require("../index");
const google_auth_1 = require("./google-auth");
async function syncCalendar(calendarAccountId) {
    const account = await index_1.prisma.calendarAccount.findUnique({
        where: { id: calendarAccountId },
    });
    if (!account)
        throw new Error('Calendar account not found');
    const auth = (0, google_auth_1.getAuthClient)(account.accessToken, account.refreshToken || undefined);
    const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
    let pageToken;
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
                await index_1.prisma.calendarEvent.deleteMany({
                    where: { calendarAccountId, externalId: event.id },
                });
                continue;
            }
            const start = event.start?.dateTime || event.start?.date;
            const end = event.end?.dateTime || event.end?.date;
            if (!start || !end)
                continue;
            await index_1.prisma.calendarEvent.upsert({
                where: {
                    calendarAccountId_externalId: {
                        calendarAccountId,
                        externalId: event.id,
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
                    externalId: event.id,
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
            await index_1.prisma.calendarAccount.update({
                where: { id: calendarAccountId },
                data: { syncToken: response.data.nextSyncToken, lastSyncedAt: new Date() },
            });
        }
    } while (pageToken);
    return synced;
}
async function getEventsForUser(userId, from, to) {
    const accounts = await index_1.prisma.calendarAccount.findMany({
        where: { userId },
    });
    const events = await index_1.prisma.calendarEvent.findMany({
        where: {
            calendarAccountId: { in: accounts.map(a => a.id) },
            startTime: { lt: to },
            endTime: { gt: from },
        },
        orderBy: { startTime: 'asc' },
    });
    return events;
}
//# sourceMappingURL=calendar-sync.js.map