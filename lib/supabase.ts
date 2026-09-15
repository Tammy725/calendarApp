import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from './stores/auth-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Set them in your .env file.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export interface ParticipantRow {
  id: string;
  room_id: string;
  user_id: string | null;
  guest_name: string | null;
  created_at: string;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  from_date: string | null;
  to_date: string | null;
  start_hour: number | null;
  end_hour: number | null;
  duration_idx: number | null;
  period_idx: number | null;
  group_size: number | null;
}

export function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDateString(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

export function participantName(
  row: ParticipantRow,
  selfUserId: string | null | undefined,
): string {
  if (row.user_id && selfUserId && row.user_id === selfUserId) return 'Tú';
  if (row.guest_name?.startsWith('anon-')) return 'Participante';
  return row.guest_name || 'Participante';
}

export async function fetchParticipantsByRoom(
  code: string,
): Promise<ParticipantRow[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('id, room_id, user_id, guest_name, created_at')
    .eq('room_id', code)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[supabase] fetchParticipantsByRoom error:', error);
    return [];
  }

  return (data ?? []) as unknown as ParticipantRow[];
}

const COLS_MISSING_CODES = ['42703', 'PGRST204'];

export async function createRoom(room: {
  code: string;
  name: string;
  fromDate?: Date;
  toDate?: Date;
  startHour?: number;
  endHour?: number;
  durationIdx?: number;
  periodIdx?: number;
  groupSize?: number;
}): Promise<{ ok: boolean }> {
  let { error } = await supabase.from('rooms').insert({
    id: room.code,
    code: room.code,
    name: room.name,
    from_date: room.fromDate ? toDateString(room.fromDate) : null,
    to_date: room.toDate ? toDateString(room.toDate) : null,
    start_hour: room.startHour ?? null,
    end_hour: room.endHour ?? null,
    duration_idx: room.durationIdx ?? null,
    period_idx: room.periodIdx ?? null,
    group_size: room.groupSize ?? null,
  });

  if (COLS_MISSING_CODES.includes(error?.code ?? '')) {
    const { error: baseError } = await supabase
      .from('rooms')
      .insert({ id: room.code, code: room.code, name: room.name });
    error = baseError ?? null;
  }

  if (error) {
    console.error('[supabase] createRoom error:', error);
    return { ok: false };
  }
  return { ok: true };
}

export async function getRoomByCode(code: string): Promise<RoomRow | null> {
  let { data, error } = await supabase
    .from('rooms')
    .select(
      'id, code, name, from_date, to_date, start_hour, end_hour, duration_idx, period_idx, group_size',
    )
    .eq('code', code)
    .maybeSingle();

  if (COLS_MISSING_CODES.includes(error?.code ?? '')) {
    ({ data, error } = await supabase
      .from('rooms')
      .select('id, code, name')
      .eq('code', code)
      .maybeSingle());
  }

  if (error) {
    console.error('[supabase] getRoomByCode error:', error);
    return null;
  }
  return (data as RoomRow | null) ?? null;
}

function anonymousGuestId(): string {
  const id =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `anon-${id}`;
}

const SESSION_ANON_ID = anonymousGuestId();

export async function joinRoomAsParticipant(
  code: string,
  guestName?: string,
): Promise<{ ok: boolean }> {
  const room = await getRoomByCode(code);
  if (!room) return { ok: false };

  const selfUserId = useAuthStore.getState().user?.id ?? null;
  const effectiveGuestName = selfUserId ? undefined : guestName || SESSION_ANON_ID;

  let query = supabase
    .from('participants')
    .select('id')
    .eq('room_id', room.id);
  if (selfUserId) {
    query = query.eq('user_id', selfUserId);
  } else {
    query = query.eq('guest_name', effectiveGuestName);
  }
  const { data } = await query.maybeSingle();
  if (data?.id) return { ok: true };

  const { error } = await supabase.from('participants').insert({
    room_id: room.id,
    user_id: selfUserId,
    guest_name: effectiveGuestName,
  });

  if (error) {
    console.error('[supabase] joinRoomAsParticipant error:', error);
    return { ok: false };
  }
  return { ok: true };
}
