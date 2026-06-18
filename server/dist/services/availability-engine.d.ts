interface TimeSlot {
    start: Date;
    end: Date;
}
interface AvailabilityResult {
    slot: TimeSlot;
    availableUserIds: string[];
    totalUsers: number;
    score: number;
}
export declare function computeAvailability(roomId: string): Promise<AvailabilityResult[]>;
export declare function getRoomStats(roomId: string): Promise<{
    bestScore: number;
    averageScore: number;
    bestHour: number;
    bestDay: number;
    longestBlockMs: number;
    totalSuggestions: number;
    bestSuggestionCount: number;
} | null>;
export {};
//# sourceMappingURL=availability-engine.d.ts.map