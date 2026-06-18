"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarRouter = void 0;
const express_1 = require("express");
const googleapis_1 = require("googleapis");
const index_1 = require("../index");
const calendar_sync_1 = require("../services/calendar-sync");
const google_auth_1 = require("../services/google-auth");
exports.calendarRouter = (0, express_1.Router)();
exports.calendarRouter.get('/', async (req, res) => {
    const accounts = await index_1.prisma.calendarAccount.findMany({
        where: { userId: req.userId },
        select: { id: true, email: true, provider: true, lastSyncedAt: true, calendarId: true },
    });
    res.json(accounts);
});
exports.calendarRouter.post('/sync', async (req, res) => {
    try {
        const { accountId } = req.body;
        const account = await index_1.prisma.calendarAccount.findFirst({
            where: { id: accountId, userId: req.userId },
        });
        if (!account)
            return res.status(404).json({ error: 'Calendar account not found' });
        const count = await (0, calendar_sync_1.syncCalendar)(accountId);
        res.json({ synced: count, message: `Synced ${count} events` });
    }
    catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
    }
});
exports.calendarRouter.post('/sync-all', async (req, res) => {
    const accounts = await index_1.prisma.calendarAccount.findMany({
        where: { userId: req.userId },
    });
    const results = await Promise.allSettled(accounts.map(a => (0, calendar_sync_1.syncCalendar)(a.id).catch(e => {
        console.error(`Failed to sync ${a.email}:`, e);
        return 0;
    })));
    const total = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
    res.json({ synced: total, accounts: accounts.length });
});
exports.calendarRouter.get('/events', async (req, res) => {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const accounts = await index_1.prisma.calendarAccount.findMany({
        where: { userId: req.userId },
        select: { id: true },
    });
    const events = await index_1.prisma.calendarEvent.findMany({
        where: {
            calendarAccountId: { in: accounts.map(a => a.id) },
            startTime: { lt: toDate },
            endTime: { gt: fromDate },
        },
        orderBy: { startTime: 'asc' },
    });
    res.json(events);
});
exports.calendarRouter.post('/events/create', async (req, res) => {
    try {
        const { title, description, startTime, endTime, timeZone } = req.body;
        if (!title || !startTime || !endTime) {
            return res.status(400).json({ error: 'title, startTime, and endTime are required' });
        }
        const account = await index_1.prisma.calendarAccount.findFirst({
            where: { userId: req.userId },
            orderBy: { createdAt: 'asc' },
        });
        if (!account)
            return res.status(400).json({ error: 'No calendar connected' });
        const auth = (0, google_auth_1.getAuthClient)(account.accessToken, account.refreshToken || undefined);
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
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
    }
    catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: error?.message || 'Failed to create event' });
    }
});
exports.calendarRouter.delete('/:id', async (req, res) => {
    const accountId = req.params.id;
    const account = await index_1.prisma.calendarAccount.findFirst({
        where: { id: accountId, userId: req.userId },
    });
    if (!account)
        return res.status(404).json({ error: 'Account not found' });
    await index_1.prisma.calendarEvent.deleteMany({ where: { calendarAccountId: account.id } });
    await index_1.prisma.calendarAccount.delete({ where: { id: account.id } });
    res.json({ message: 'Calendar disconnected' });
});
//# sourceMappingURL=calendar.js.map