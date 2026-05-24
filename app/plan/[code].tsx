import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api/rooms';
import { calendarApi } from '@/lib/api/calendar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api/client';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

export default function PlanScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const user = useAuthStore((s) => s.user);

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [startHour, setStartHour] = useState(18);
  const [endHour, setEndHour] = useState(20);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [checked, setChecked] = useState(false);

  const { data: room, isLoading, refetch } = useQuery({
    queryKey: ['room', code],
    queryFn: () => roomsApi.get(code!),
    enabled: !!code,
  });

  const joinMutation = useMutation({
    mutationFn: () => roomsApi.join(code!),
    onSuccess: () => refetch(),
  });

  const syncMutation = useMutation({
    mutationFn: () => calendarApi.syncAll(),
  });

  useEffect(() => {
    if (room && user) {
      const isMember = room.participants.some(p => p.userId === user.id);
      if (!isMember) {
        joinMutation.mutate();
      } else {
        syncMutation.mutate();
      }
    }
  }, [room?.id, user?.id]);

  const handleCheck = async () => {
    try {
      const data = await api.post<CheckResponse>(`/availability/check/${code}`, {
        dayOfWeek: selectedDay,
        startHour,
        endHour,
      });
      setResults(data.results);
      setChecked(true);
    } catch {
      Alert.alert('Error', 'No se pudo verificar disponibilidad');
    }
  };

  const handleShare = async () => {
    if (!room) return;
    await Share.share({
      message: `📅 Únete a mi plan en MiApp con el código: ${room.name}\n\nDescarga la app y usa el código para unirte.`,
    });
  };

  const allFree = checked && results.length > 0 && results.every(r => r.free);
  const someoneBusy = checked && results.some(r => !r.free);

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
        <Text style={{ fontSize: 18, color: '#c92a2a' }}>Plan no encontrado</Text>
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
        <Text style={styles.sectionTitle}>Participantes ({room.participants.length})</Text>
        {room.participants.map((p) => (
          <View key={p.id} style={styles.participantRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(p.user.name || p.user.email).charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.participantName}>{p.user.name || p.user.email}</Text>
            <View style={[styles.badge, p.status === 'ACCEPTED' ? styles.accepted : styles.pending]}>
              <Text style={p.status === 'ACCEPTED' ? styles.acceptedText : styles.pendingText}>
                {p.status === 'ACCEPTED' ? 'Conectado' : 'Pendiente'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.checkSection}>
        <Text style={styles.sectionTitle}>¿Cuándo quieres quedar?</Text>

        <Text style={styles.label}>Día de la semana</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
          {DAYS.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, selectedDay === i && styles.dayChipSelected]}
              onPress={() => setSelectedDay(i)}
            >
              <Text style={[styles.dayChipText, selectedDay === i && styles.dayChipTextSelected]}>
                {day.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.hoursRow}>
          <View style={styles.hourBlock}>
            <Text style={styles.label}>Desde</Text>
            <View style={styles.hourControl}>
              <TouchableOpacity onPress={() => setStartHour(Math.max(0, startHour - 1))}>
                <Text style={styles.arrow}>−</Text>
              </TouchableOpacity>
              <Text style={styles.hourValue}>{startHour}:00</Text>
              <TouchableOpacity onPress={() => setStartHour(Math.min(23, startHour + 1))}>
                <Text style={styles.arrow}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.hourBlock}>
            <Text style={styles.label}>Hasta</Text>
            <View style={styles.hourControl}>
              <TouchableOpacity onPress={() => setEndHour(Math.max(0, endHour - 1))}>
                <Text style={styles.arrow}>−</Text>
              </TouchableOpacity>
              <Text style={styles.hourValue}>{endHour}:00</Text>
              <TouchableOpacity onPress={() => setEndHour(Math.min(23, endHour + 1))}>
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
          <Text style={styles.sectionTitle}>Resultados</Text>

          {allFree && (
            <View style={styles.banner}>
              <Text style={styles.bannerEmoji}>🎉</Text>
              <Text style={styles.bannerTitle}>¡Todos libres!</Text>
              <Text style={styles.bannerSub}>
                {DAYS[selectedDay]} de {startHour}:00 a {endHour}:00
              </Text>
            </View>
          )}
          {someoneBusy && (
            <View style={[styles.banner, styles.conflictBanner]}>
              <Text style={styles.bannerEmoji}>😬</Text>
              <Text style={[styles.bannerTitle, { color: '#c92a2a' }]}>Hay conflictos</Text>
              <Text style={styles.bannerSub}>
                {DAYS[selectedDay]} de {startHour}:00 a {endHour}:00
              </Text>
            </View>
          )}

          {results.map((r) => (
            <View key={r.userId} style={styles.resultRow}>
              <View style={styles.resultInfo}>
                <View style={[styles.resultAvatar, { backgroundColor: r.free ? '#2b8a3e' : '#c92a2a' }]}>
                  <Text style={styles.resultAvatarText}>{r.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.resultName}>{r.name}</Text>
              </View>
              <Text style={[styles.resultStatus, { color: r.free ? '#2b8a3e' : '#c92a2a' }]}>
                {r.free ? '✓ Libre' : '✗ Ocupado'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#11181C', flex: 1 },
  shareLink: { fontSize: 15, fontWeight: '600', color: '#0a7ea4' },
  participantsSection: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#11181C' },
  participantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0a7ea4',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  participantName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#11181C' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  accepted: { backgroundColor: '#d3f9d8' },
  pending: { backgroundColor: '#fff3bf' },
  acceptedText: { fontSize: 12, fontWeight: '600', color: '#2b8a3e' },
  pendingText: { fontSize: 12, fontWeight: '600', color: '#e67700' },
  checkSection: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#495057' },
  dayPicker: { flexDirection: 'row' },
  dayChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#f1f3f5', marginRight: 8,
  },
  dayChipSelected: { backgroundColor: '#0a7ea4' },
  dayChipText: { fontSize: 14, fontWeight: '600', color: '#495057' },
  dayChipTextSelected: { color: '#fff' },
  hoursRow: { flexDirection: 'row', gap: 16 },
  hourBlock: { flex: 1 },
  hourControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12, marginTop: 4,
  },
  arrow: { fontSize: 24, color: '#0a7ea4', fontWeight: '600', paddingHorizontal: 8 },
  hourValue: { fontSize: 20, fontWeight: '700', color: '#11181C', minWidth: 60, textAlign: 'center' },
  checkButton: {
    backgroundColor: '#0a7ea4', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4,
  },
  checkButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  syncButton: { alignItems: 'center', paddingVertical: 10 },
  syncText: { fontSize: 14, color: '#0a7ea4', fontWeight: '500' },
  resultsSection: { gap: 10 },
  banner: {
    backgroundColor: '#d3f9d8', borderRadius: 16, padding: 24, alignItems: 'center', gap: 4,
  },
  conflictBanner: { backgroundColor: '#ffe3e3' },
  bannerEmoji: { fontSize: 40 },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: '#2b8a3e' },
  bannerSub: { fontSize: 15, color: '#495057' },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8f9fa', padding: 14, borderRadius: 10,
  },
  resultInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  resultAvatarText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  resultName: { fontSize: 15, fontWeight: '500', color: '#11181C' },
  resultStatus: { fontSize: 15, fontWeight: '600' },
});
