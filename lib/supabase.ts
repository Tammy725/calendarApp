import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
}

export function participantName(
  row: ParticipantRow,
  selfUserId: string | null | undefined,
): string {
  if (row.user_id && selfUserId && row.user_id === selfUserId) return 'Tú';
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

export async function createRoom(room: {
  code: string;
  name: string;
}): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('rooms')
    .insert({ id: room.code, code: room.code, name: room.name });

  if (error) {
    console.error('[supabase] createRoom error:', error);
    return { ok: false };
  }
  return { ok: true };
}

export async function getRoomByCode(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, name')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('[supabase] getRoomByCode error:', error);
    return null;
  }
  return (data as RoomRow | null) ?? null;
}

export async function joinRoomAsParticipant(
  code: string,
  guestName?: string,
): Promise<{ ok: boolean }> {
  const room = await getRoomByCode(code);
  if (!room) return { ok: false };

  const selfUserId = null;

  const { error } = await supabase.from('participants').insert({
    room_id: room.id,
    user_id: selfUserId,
    guest_name: guestName ?? null,
  });

  if (error) {
    console.error('[supabase] joinRoomAsParticipant error:', error);
    return { ok: false };
  }
  return { ok: true };
}
