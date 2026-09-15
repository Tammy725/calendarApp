import { type SupabaseClient } from "@supabase/supabase-js";
export declare const supabase: SupabaseClient | null;
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
export declare function fetchRoomAndParticipants(roomId: string): Promise<{
    room: ServerRoomRow;
    participants: ServerParticipantRow[];
} | null>;
//# sourceMappingURL=supabase.d.ts.map