import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL as string | undefined;
const supabaseServiceKey = process.env
  .SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export interface ServerRoomRow {
  id: string;
  code: string;
  name: string;
}

export interface ServerParticipantRow {
  id: string;
  room_id: string;
  user_id: string | null;
  guest_name: string | null;
}

export async function fetchRoomAndParticipants(
  roomId: string,
): Promise<{ room: ServerRoomRow; participants: ServerParticipantRow[] } | null> {
  if (!supabase) return null;

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, code, name")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError || !room) return null;

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, room_id, user_id, guest_name")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (participantsError) return null;

  return {
    room: room as ServerRoomRow,
    participants: (participants ?? []) as ServerParticipantRow[],
  };
}