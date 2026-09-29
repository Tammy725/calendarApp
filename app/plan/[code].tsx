import { calendarApi } from "@/lib/api/calendar";
import { api } from "@/lib/api/client";
import {
  fetchParticipantsByRoom,
  getRoomByCode,
  joinRoomAsParticipant,
  participantName,
  type ParticipantRow,
  type RoomRow,
} from "@/lib/supabase";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

interface CheckResult {
  userId: string;
  name: string;
  free: boolean;
}

interface CheckResponse {
  dayOfWeek: number;
  date: string;
  from: string;
  to: string;
  results: CheckResult[];
  allFree: boolean;
  totalParticipants: number;
}

interface SlotParticipantRow {
  userId: string;
  name: string;
  free: boolean;
}

interface AvailabilitySlot {
  start: string;
  end: string;
  freeCount: number;
  total: number;
  participants: SlotParticipantRow[];
}

interface SlotsResponse {
  from: string;
  to: string;
  slotMinutes: number;
  slots: AvailabilitySlot[];
  totalParticipants: number;
}

export default function PlanScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const user = useAuthStore((s) => s.user);

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [startHour, setStartHour] = useState(18);
  const [endHour, setEndHour] = useState(20);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoom = useCallback(async () => {
    if (!code) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const found = await getRoomByCode(code);
    setRoom(found);
    if (found) {
      const rows = await fetchParticipantsByRoom(found.id);
      setParticipants(rows);
    }
    setIsLoading(false);
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRoom();
    return () => {};
  }, [loadRoom]);

  const joinMutation = {
    mutate: () => {
      if (code) joinRoomAsParticipant(code);
    },
  };

  const syncMutation = useMutation({
    mutationFn: () => calendarApi.syncAll(),
  });

  const syncedRef = useRef(false);

  const joinedKey = participants.map((p) => p.user_id).join(',');

  useEffect(() => {
    if (room && user) {
      const isMember = participants.some((p) => p.user_id === user.id);
      if (!isMember) {
        joinMutation.mutate();
      } else {
        syncedRef.current = true;
        syncMutation.mutate();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, joinedKey, user?.id]);

  const fetchAvailability = useCallback(
    async (showSpinner = false) => {
      if (!code) return;
      if (!user) {
        setChecked(false);
        return;
      }
      if (endHour <= startHour) return;
      if (showSpinner) setRefreshing(true);
      try {
        if (!syncedRef.current) {
          syncedRef.current = true;
          await syncMutation.mutateAsync();
        }
        const now = new Date();
        const dayDiff = (selectedDay - now.getDay() + 7) % 7;
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + (dayDiff === 0 ? 7 : dayDiff));
        targetDate.setHours(0, 0, 0, 0);
        const from = new Date(targetDate);
        from.setHours(startHour, 0, 0, 0);
        const to = new Date(targetDate);
        to.setHours(endHour, 0, 0, 0);

        const data = await api.post<CheckResponse>(
          `/availability/check/${code}`,
          {
            dayOfWeek: selectedDay,
            startHour,
            endHour,
            from: from.toISOString(),
            to: to.toISOString(),
          },
        );
        setResults(data.results);
        setChecked(true);

        const slotsData = await api.post<SlotsResponse>(
          `/availability/slots/${code}`,
          {
            from: from.toISOString(),
            to: to.toISOString(),
            slotMinutes: 60,
          },
        );
        setSlots(slotsData.slots);
      } catch {
        if (showSpinner) {
          Alert.alert("Error", "No se pudo verificar disponibilidad");
        }
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, user, selectedDay, startHour, endHour],
  );

  const handleCheck = () => {
    if (endHour <= startHour) {
      Alert.alert("Revisá las horas", "La hora 'Hasta' debe ser después que la hora 'Desde'.");
      return;
    }
    fetchAvailability(true);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      loadRoom();
      if (checked) fetchAvailability();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadRoom, checked, fetchAvailability]);

  const handleShare = async () => {
    if (!room) return;
    await Share.share({
      message: `📅 Únete a mi plan en MiApp con el código: ${room.code}\n\nDescarga la app y usa el código para unirte.`,
    });
  };

  const bestSlot = slots.reduce(
    (best, s) => (s.freeCount > best.freeCount ? s : best),
    slots[0],
  );

  const fmtHourRange = (s: { start: string; end: string }) => {
    const st = new Date(s.start);
    const en = new Date(s.end);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(st.getHours())}:00 – ${pad(en.getHours())}:00`;
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 18, color: "#c92a2a" }}>
          Plan no encontrado
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{room.name}</Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareLink}>Compartir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.participantsSection}>
        <Text style={styles.sectionTitle}>
          Participantes ({participants.length})
        </Text>
        {participants.map((p) => {
          const name = participantName(p, user?.id);
          return (
            <View key={p.id} style={styles.participantRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.participantName}>{name}</Text>
              <View style={[styles.badge, styles.accepted]}>
                <Text style={styles.acceptedText}>Unido</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.checkSection}>
        <Text style={styles.sectionTitle}>¿Cuándo quieres quedar?</Text>

        <Text style={styles.label}>Día de la semana</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayPicker}
        >
          {DAYS.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.dayChip,
                selectedDay === i && styles.dayChipSelected,
              ]}
              onPress={() => setSelectedDay(i)}
            >
              <Text
                style={[
                  styles.dayChipText,
                  selectedDay === i && styles.dayChipTextSelected,
                ]}
              >
                {day.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.hoursRow}>
          <View style={styles.hourBlock}>
            <Text style={styles.label}>Desde</Text>
            <View style={styles.hourControl}>
              <TouchableOpacity
                onPress={() => setStartHour(Math.max(0, startHour - 1))}
              >
                <Text style={styles.arrow}>−</Text>
              </TouchableOpacity>
              <Text style={styles.hourValue}>{startHour}:00</Text>
              <TouchableOpacity
                onPress={() => setStartHour(Math.min(23, startHour + 1))}
              >
                <Text style={styles.arrow}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.hourBlock}>
            <Text style={styles.label}>Hasta</Text>
            <View style={styles.hourControl}>
              <TouchableOpacity
                onPress={() => setEndHour(Math.max(0, endHour - 1))}
              >
                <Text style={styles.arrow}>−</Text>
              </TouchableOpacity>
              <Text style={styles.hourValue}>{endHour}:00</Text>
              <TouchableOpacity
                onPress={() => setEndHour(Math.min(23, endHour + 1))}
              >
                <Text style={styles.arrow}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.checkButton} onPress={handleCheck}>
          <Text style={styles.checkButtonText}>Ver disponibilidad</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <ActivityIndicator color="#0a7ea4" size="small" />
          ) : (
            <Text style={styles.syncText}>Sincronizar mi calendario</Text>
          )}
        </TouchableOpacity>
      </View>

      {checked && (
        <View style={styles.resultsSection}>
          {refreshing && (
            <View style={styles.refreshingRow}>
              <ActivityIndicator size="small" color="#0a7ea4" />
              <Text style={styles.refreshingText}>Actualizando…</Text>
            </View>
          )}

          {slots.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Horarios · {bestSlot ? `${bestSlot.freeCount} de ${bestSlot.total} disponibles` : ""}
              </Text>

              {bestSlot && bestSlot.freeCount === bestSlot.total ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerEmoji}>🎉</Text>
                  <Text style={styles.bannerTitle}>¡Todos libres!</Text>
                  <Text style={styles.bannerSub}>
                    {DAYS[selectedDay]} · {fmtHourRange(bestSlot)}
                  </Text>
                </View>
              ) : bestSlot ? (
                <View style={[styles.banner, styles.conflictBanner]}>
                  <Text style={styles.bannerEmoji}>😬</Text>
                  <Text style={[styles.bannerTitle, { color: "#c92a2a" }]}>
                    {bestSlot.freeCount} de {bestSlot.total} disponibles
                  </Text>
                  <Text style={styles.bannerSub}>Mejor momento: {fmtHourRange(bestSlot)}</Text>
                </View>
              ) : null}

              <View style={styles.slotList}>
                {slots.map((s) => {
                  const slotStyle =
                    s.freeCount === s.total
                      ? styles.slotFree
                      : s.freeCount > 0
                        ? styles.slotSome
                        : styles.slotBusy;
                  const mark =
                    s.freeCount === s.total ? "✓" : s.freeCount > 0 ? "◐" : "✗";
                  return (
                    <View key={s.start} style={styles.slotRow}>
                      <Text style={styles.slotTime}>{fmtHourRange(s)}</Text>
                      <Text style={[styles.slotCount, slotStyle]}>
                        {mark} {s.freeCount} de {s.total} libres
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {results.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Persona por persona</Text>
              {results.map((r) => (
                <View key={r.userId} style={styles.resultRow}>
                  <View style={styles.resultInfo}>
                    <View
                      style={[
                        styles.resultAvatar,
                        { backgroundColor: r.free ? "#2b8a3e" : "#c92a2a" },
                      ]}
                    >
                      <Text style={styles.resultAvatarText}>
                        {r.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.resultName}>{r.name}</Text>
                  </View>
                  <Text
                    style={[
                      styles.resultStatus,
                      { color: r.free ? "#2b8a3e" : "#c92a2a" },
                    ]}
                  >
                    {r.free ? "✓ Libre" : "✗ Ocupado"}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, gap: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#11181C", flex: 1 },
  shareLink: { fontSize: 15, fontWeight: "600", color: "#0a7ea4" },
  participantsSection: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#11181C" },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0a7ea4",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  participantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#11181C",
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  accepted: { backgroundColor: "#d3f9d8" },
  pending: { backgroundColor: "#fff3bf" },
  acceptedText: { fontSize: 12, fontWeight: "600", color: "#2b8a3e" },
  pendingText: { fontSize: 12, fontWeight: "600", color: "#e67700" },
  checkSection: { gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#495057" },
  dayPicker: { flexDirection: "row" },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f1f3f5",
    marginRight: 8,
  },
  dayChipSelected: { backgroundColor: "#0a7ea4" },
  dayChipText: { fontSize: 14, fontWeight: "600", color: "#495057" },
  dayChipTextSelected: { color: "#fff" },
  hoursRow: { flexDirection: "row", gap: 16 },
  hourBlock: { flex: 1 },
  hourControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  arrow: {
    fontSize: 24,
    color: "#0a7ea4",
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  hourValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#11181C",
    minWidth: 60,
    textAlign: "center",
  },
  checkButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  checkButtonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  syncButton: { alignItems: "center", paddingVertical: 10 },
  syncText: { fontSize: 14, color: "#0a7ea4", fontWeight: "500" },
  resultsSection: { gap: 10 },
  refreshingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  refreshingText: { fontSize: 13, color: "#687076" },
  slotList: { gap: 6 },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  slotTime: { fontSize: 15, fontWeight: "600", color: "#11181C" },
  slotCount: { fontSize: 15, fontWeight: "700" },
  slotFree: { color: "#2b8a3e" },
  slotSome: { color: "#e67700" },
  slotBusy: { color: "#c92a2a" },
  banner: {
    backgroundColor: "#d3f9d8",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 4,
  },
  conflictBanner: { backgroundColor: "#ffe3e3" },
  bannerEmoji: { fontSize: 40 },
  bannerTitle: { fontSize: 20, fontWeight: "700", color: "#2b8a3e" },
  bannerSub: { fontSize: 15, color: "#495057" },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 14,
    borderRadius: 10,
  },
  resultInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  resultAvatarText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  resultName: { fontSize: 15, fontWeight: "500", color: "#11181C" },
  resultStatus: { fontSize: 15, fontWeight: "600" },
});
