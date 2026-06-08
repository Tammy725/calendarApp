import { api } from './client';
import type { CalendarAccount, CalendarEvent } from '../types';

export const calendarApi = {
  list: () => api.get<CalendarAccount[]>('/calendar'),

  sync: (accountId: string) =>
    api.post<{ synced: number; message: string }>('/calendar/sync', { accountId }),

  syncAll: () =>
    api.post<{ synced: number; accounts: number }>('/calendar/sync-all'),

  getEvents: (from: string, to: string) =>
    api.get<CalendarEvent[]>(`/calendar/events?from=${from}&to=${to}`),

  disconnect: (id: string) =>
    api.delete<{ message: string }>(`/calendar/${id}`),

  createEvent: (data: { title: string; description?: string; startTime: string; endTime: string; timeZone?: string }) =>
    api.post<{ event: any; htmlLink: string }>('/calendar/events/create', data),
};
