export declare function syncCalendar(calendarAccountId: string): Promise<number>;
export declare function getEventsForUser(userId: string, from: Date, to: Date): Promise<{
    id: string;
    timezone: string | null;
    createdAt: Date;
    updatedAt: Date;
    calendarAccountId: string;
    externalId: string;
    title: string | null;
    description: string | null;
    startTime: Date;
    endTime: Date;
    isRecurring: boolean;
    recurrenceRule: string | null;
    isAllDay: boolean;
    lastModifiedAt: Date | null;
    etag: string | null;
}[]>;
//# sourceMappingURL=calendar-sync.d.ts.map