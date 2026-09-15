import { Router } from "express";
import { prisma } from "../index";
import { AuthRequest } from "../middleware/auth";
import { fetchRoomAndParticipants } from "../lib/supabase";
import {
  computeAvailability,
  getRoomStats,
} from "../services/availability-engine";

export const availabilityRouter = Router();

availabilityRouter.post("/compute/:roomId", async (req: AuthRequest, res) => {
  try {
    const roomId = req.params.roomId as string;
    const room = await prisma.schedulingRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          where: { userId: req.userId! },
        },
      },
    });

    if (!room || room.participants.length === 0) {
      return res.status(404).json({ error: "Room not found or not a member" });
    }

    const results = await computeAvailability(roomId);

    const top = results
      .filter((r) => r.score > 0)
      .slice(0, 20)
      .map((r) => ({
        start: r.slot.start,
        end: r.slot.end,
        score: r.score,
        availableCount: r.availableUserIds.length,
        totalCount: r.totalUsers,
        availableUserIds: r.availableUserIds,
      }));

    res.json({ suggestions: top, total: results.length });
  } catch (error) {
    console.error("Availability compute error:", error);
    res.status(500).json({ error: "Failed to compute availability" });
  }
});

availabilityRouter.get(
  "/suggestions/:roomId",
  async (req: AuthRequest, res) => {
    const suggestions = await prisma.suggestion.findMany({
      where: { roomId: req.params.roomId as string },
      orderBy: { score: "desc" },
      take: 50,
    });

    res.json(suggestions);
  },
);

availabilityRouter.get("/stats/:roomId", async (req: AuthRequest, res) => {
  const stats = await getRoomStats(req.params.roomId as string);
  if (!stats) return res.status(404).json({ error: "No availability data" });
  res.json(stats);
});

interface CalendarEventLike {
  startTime: Date;
  endTime: Date;
}

interface CalendarAccountLike {
  events: CalendarEventLike[];
}

interface CheckEntry {
  userId: string;
  name: string;
  user: { calendarAccounts: CalendarAccountLike[] } | null;
}

async function loadCheckEntries(roomId: string): Promise<CheckEntry[] | null> {
  const room = await prisma.schedulingRoom.findUnique({
    where: { id: roomId },
    include: {
      participants: {
        where: { status: "ACCEPTED" },
        include: {
          user: {
            include: {
              calendarAccounts: {
                include: {
                  events: {
                    where: {
                      isAllDay: false,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (room) {
    return room.participants.map((p) => {
      if (!p.user) {
        return {
          userId: p.guestName || `guest-${p.id}`,
          name: p.guestName || "Invitado",
          user: null,
        };
      }
      return {
        userId: p.user.id,
        name: p.user.name || p.user.email,
        user: p.user as CheckEntry["user"],
      };
    });
  }

  // Fallback: the plan may live in Supabase (rooms keyed by invitation code)
  const supabaseRoom = await fetchRoomAndParticipants(roomId);
  if (!supabaseRoom) return null;

  const entries: CheckEntry[] = [];
  for (const participant of supabaseRoom.participants) {
    if (participant.user_id) {
      const user = await prisma.user.findUnique({
        where: { id: participant.user_id },
        include: {
          calendarAccounts: {
            include: {
              events: {
                where: {
                  isAllDay: false,
                },
              },
            },
          },
        },
      });
      entries.push(
        user
          ? {
              userId: user.id,
              name: user.name || user.email,
              user: user as CheckEntry["user"],
            }
          : {
              userId: participant.user_id,
              name: participant.guest_name || "Invitado",
              user: null,
            },
      );
    } else {
      entries.push({
        userId: participant.id,
        name: participant.guest_name || "Invitado",
        user: null,
      });
    }
  }

  return entries;
}

availabilityRouter.post("/check/:roomId", async (req: AuthRequest, res) => {
  try {
    const roomId = req.params.roomId as string;
    const { dayOfWeek, startHour, endHour } = req.body;

    const entries = await loadCheckEntries(roomId);
    if (!entries) return res.status(404).json({ error: "Room not found" });

    const now = new Date();
    const dayDiff = (dayOfWeek - now.getDay() + 7) % 7;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + (dayDiff === 0 ? 7 : dayDiff));
    targetDate.setHours(0, 0, 0, 0);

    const checkFrom = new Date(targetDate);
    checkFrom.setHours(startHour, 0, 0, 0);
    const checkTo = new Date(targetDate);
    checkTo.setHours(endHour, 0, 0, 0);

    const results = entries.map((entry) => {
      if (!entry.user) {
        // Guest participant without a user account → assume free (no calendar to check)
        return {
          userId: entry.userId,
          name: entry.name,
          free: true,
        };
      }
      let hasConflict = false;

      for (const account of entry.user.calendarAccounts) {
        for (const event of account.events) {
          const eStart = new Date(event.startTime);
          const eEnd = new Date(event.endTime);

          if (eStart < checkTo && eEnd > checkFrom) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) break;
      }

      return {
        userId: entry.userId,
        name: entry.name,
        free: !hasConflict,
      };
    });

    res.json({
      dayOfWeek,
      date: targetDate.toISOString(),
      from: checkFrom.toISOString(),
      to: checkTo.toISOString(),
      results,
      allFree: results.every((r) => r.free),
      totalParticipants: results.length,
    });
  } catch (error) {
    console.error("Check error:", error);
    res.status(500).json({ error: "Failed to check availability" });
  }
});

availabilityRouter.post("/finalize/:roomId", async (req: AuthRequest, res) => {
  const { suggestionId } = req.body;
  const roomId = req.params.roomId as string;

  const room = await prisma.schedulingRoom.findFirst({
    where: { id: roomId, createdById: req.userId! },
  });
  if (!room)
    return res.status(404).json({ error: "Room not found or not owner" });

  await prisma.schedulingRoom.update({
    where: { id: roomId },
    data: { status: "FINALIZED" },
  });

  res.json({ message: "Time finalized" });
});
