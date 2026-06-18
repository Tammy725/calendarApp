import { prisma } from '../index';

interface BusyBlock {
  start: Date;
  end: Date;
}

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

const SLOT_DURATION_MINUTES = 30;

function mergeBusyBlocks(blocks: BusyBlock[]): BusyBlock[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), sorted[i].end.getTime()));
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

function getMinutesSinceMidnight(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export async function computeAvailability(roomId: string): Promise<AvailabilityResult[]> {
  const room = await prisma.schedulingRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: {
        where: { status: 'ACCEPTED' },
        include: {
          user: {
            include: { calendarAccounts: { include: { events: true } } },
          },
        },
      },
    },
  });

  if (!room) throw new Error('Room not found');

  const participants = room.participants;
  const totalUsers = participants.length;
  if (totalUsers === 0) return [];

  const dateStart = room.dateStart || new Date();
  const dateEnd = room.dateEnd || new Date(dateStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const earliestHour = room.earliestTime ?? 8;
  const latestHour = room.latestTime ?? 20;
  const meetingDuration = room.durationMinutes;
  const buffer = room.bufferMinutes;

  const days: Date[] = [];
  const current = new Date(dateStart);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(dateEnd);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const results: AvailabilityResult[] = [];
  const slotDurationMs = SLOT_DURATION_MINUTES * 60 * 1000;

  for (const day of days) {
    const dayStart = new Date(day);
    dayStart.setUTCHours(earliestHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setUTCHours(latestHour, 0, 0, 0);

    let slotStart = new Date(dayStart);

    while (slotStart.getTime() + meetingDuration * 60 * 1000 <= dayEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + meetingDuration * 60 * 1000);
      const availableUserIds: string[] = [];

      for (const participant of participants) {
        if (!participant.user) continue;
        const user = participant.user;
        const prefStartHour = user.preferredStartHour ?? 9;
        const prefEndHour = user.preferredEndHour ?? 17;
        const unavailableDays = (user.unavailableDays as number[]) || [];

        const dayOfWeek = day.getUTCDay();
        if (unavailableDays.includes(dayOfWeek)) continue;

        const slotMinutes = getMinutesSinceMidnight(slotStart);
        const slotEndMinutes = getMinutesSinceMidnight(slotEnd);

        const prefStartMin = prefStartHour * 60;
        const prefEndMin = prefEndHour * 60;

        if (slotMinutes < prefStartMin || slotEndMinutes > prefEndMin) continue;

        if (user.sleepStartHour != null && user.sleepEndHour != null) {
          const sleepStartMin = user.sleepStartHour * 60;
          const sleepEndMin = user.sleepEndHour * 60;
          if (sleepStartMin > sleepEndMin) {
            if (slotMinutes >= sleepStartMin || slotEndMinutes <= sleepEndMin) continue;
          } else {
            if (slotMinutes >= sleepStartMin && slotEndMinutes <= sleepEndMin) continue;
          }
        }

        const busyBlocks: BusyBlock[] = [];
        for (const account of user.calendarAccounts) {
          for (const event of account.events) {
            if (event.isAllDay) continue;
            const eventStart = new Date(event.startTime);
            const eventEnd = new Date(event.endTime);

            if (eventEnd <= slotStart || eventStart >= slotEnd) continue;

            busyBlocks.push({
              start: new Date(Math.max(eventStart.getTime(), slotStart.getTime())),
              end: new Date(Math.min(eventEnd.getTime(), slotEnd.getTime())),
            });
          }
        }

        const merged = mergeBusyBlocks(busyBlocks);
        let totalBusyMs = 0;
        for (const block of merged) {
          totalBusyMs += block.end.getTime() - block.start.getTime();
        }

        const slotDurationMs = slotEnd.getTime() - slotStart.getTime();
        const busyRatio = totalBusyMs / slotDurationMs;

        if (busyRatio < 0.5) {
          availableUserIds.push(user.id);
        }
      }

      const score = Math.round((availableUserIds.length / totalUsers) * 100);

      results.push({
        slot: { start: new Date(slotStart), end: slotEnd },
        availableUserIds,
        totalUsers,
        score,
      });

      slotStart = new Date(slotStart.getTime() + slotDurationMs);
    }
  }

  results.sort((a, b) => b.score - a.score);

  await prisma.suggestion.deleteMany({ where: { roomId } });
  await prisma.suggestion.createMany({
    data: results.slice(0, 50).map((r, i) => ({
      roomId,
      startTime: r.slot.start,
      endTime: r.slot.end,
      score: r.score,
      participantCount: r.availableUserIds.length,
      totalCount: r.totalUsers,
      availableUserIds: r.availableUserIds,
      isBestMatch: i === 0,
    })),
  });

  return results;
}

export async function getRoomStats(roomId: string) {
  const suggestions = await prisma.suggestion.findMany({
    where: { roomId },
    orderBy: { score: 'desc' },
    take: 100,
  });

  if (suggestions.length === 0) return null;

  const topScore = suggestions[0].score;
  const bestSuggestions = suggestions.filter(s => s.score === topScore);
  const avgScore = suggestions.reduce((sum, s) => sum + s.score, 0) / suggestions.length;

  const hourCounts: Record<number, { count: number; totalScore: number }> = {};
  const dayCounts: Record<number, { count: number; totalScore: number }> = {};

  for (const s of suggestions) {
    const hour = new Date(s.startTime).getUTCHours();
    const day = new Date(s.startTime).getUTCDay();

    if (!hourCounts[hour]) hourCounts[hour] = { count: 0, totalScore: 0 };
    hourCounts[hour].count++;
    hourCounts[hour].totalScore += s.score;

    if (!dayCounts[day]) dayCounts[day] = { count: 0, totalScore: 0 };
    dayCounts[day].count++;
    dayCounts[day].totalScore += s.score;
  }

  const bestHour = Object.entries(hourCounts)
    .map(([hour, data]) => ({ hour: parseInt(hour), avg: data.totalScore / data.count }))
    .sort((a, b) => b.avg - a.avg)[0];

  const bestDay = Object.entries(dayCounts)
    .map(([day, data]) => ({ day: parseInt(day), avg: data.totalScore / data.count }))
    .sort((a, b) => b.avg - a.avg)[0];

  const bestByScore = suggestions.filter(s => s.score === topScore);
  const longestBlock = bestByScore.reduce((max, s) => {
    const dur = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    return dur > max.dur ? { dur, slot: s } : max;
  }, { dur: 0, slot: bestByScore[0] });

  return {
    bestScore: topScore,
    averageScore: Math.round(avgScore),
    bestHour: bestHour?.hour ?? null,
    bestDay: bestDay?.day ?? null,
    longestBlockMs: longestBlock.dur,
    totalSuggestions: suggestions.length,
    bestSuggestionCount: bestByScore.length,
  };
}
