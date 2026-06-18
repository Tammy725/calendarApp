export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  timezone: string;
  preferredStartHour: number;
  preferredEndHour: number;
  bufferMinutes: number;
  defaultDurationMinutes: number;
  unavailableDays: number[];
  sleepStartHour: number | null;
  sleepEndHour: number | null;
  calendarAccounts?: CalendarAccount[];
}

export interface CalendarAccount {
  id: string;
  email: string;
  provider: string;
  lastSyncedAt: string | null;
  calendarId: string;
}

export interface CalendarEvent {
  id: string;
  calendarAccountId: string;
  externalId: string;
  title: string | null;
  description: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  timezone: string | null;
  isAllDay: boolean;
}

export interface SchedulingRoom {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  durationMinutes: number;
  bufferMinutes: number;
  earliestTime: number | null;
  latestTime: number | null;
  dateStart: string | null;
  dateEnd: string | null;
  timezone: string;
  status: 'ACTIVE' | 'FINALIZED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  createdBy: Pick<User, 'id' | 'name' | 'email'> & { avatar?: string | null };
  participants: RoomParticipant[];
  suggestions?: Suggestion[];
  _count?: { suggestions: number };
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  role: 'owner' | 'member';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  user: Pick<User, 'id' | 'name' | 'email' | 'avatar' | 'timezone'>;
}

export interface Suggestion {
  id: string;
  roomId: string;
  startTime: string;
  endTime: string;
  score: number;
  participantCount: number;
  totalCount: number;
  availableUserIds: string[];
  isBestMatch: boolean;
}

export interface CreateRoomInput {
  code?: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  earliestTime?: number;
  latestTime?: number;
  dateStart?: string;
  dateEnd?: string;
  timezone?: string;
}

export interface RoomStats {
  bestScore: number;
  averageScore: number;
  bestHour: number | null;
  bestDay: number | null;
  longestBlockMs: number;
  totalSuggestions: number;
  bestSuggestionCount: number;
}
