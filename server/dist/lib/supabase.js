"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.fetchRoomAndParticipants = fetchRoomAndParticipants;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env
    .SUPABASE_SERVICE_ROLE_KEY;
exports.supabase = supabaseUrl && supabaseServiceKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
async function fetchRoomAndParticipants(roomId) {
    if (!exports.supabase)
        return null;
    const { data: room, error: roomError } = await exports.supabase
        .from("rooms")
        .select("id, code, name")
        .eq("id", roomId)
        .maybeSingle();
    if (roomError || !room)
        return null;
    const { data: participants, error: participantsError } = await exports.supabase
        .from("participants")
        .select("id, room_id, user_id, guest_name")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
    if (participantsError)
        return null;
    return {
        room: room,
        participants: (participants ?? []),
    };
}
//# sourceMappingURL=supabase.js.map