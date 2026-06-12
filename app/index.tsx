import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, Modal, Share, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { calendarApi } from '@/lib/api/calendar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { handleGoogleSignIn } from '@/lib/api/auth';
import * as Calendar from 'expo-calendar';
import { roomsApi } from '@/lib/api/rooms';
import { connectSocket, joinRoom, leaveRoom, getSocket, disconnectSocket } from '@/lib/socket';

type Participant = { name: string; initial: string; color: string; bg: string; status: string };

const PEOPLE = [
  { initial: 'T', name: 'Tú', color: '#5B4FDB', bg: '#EEF2FF' },
  { initial: 'M', name: 'María', color: '#10B981', bg: '#D1FAE5' },
  { initial: 'C', name: 'Carlos', color: '#F59E0B', bg: '#FEF3C7' },
  { initial: 'S', name: 'Sofía', color: '#DB2777', bg: '#FCE7F3' },
  { initial: 'D', name: 'Diego', color: '#9CA3AF', bg: '#F3F4F6' },
];

const HOURS = ['6h','7h','8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h','21h','22h','23h','0h','1h','2h','3h','4h','5h'];
const DISPLAY_HOURS = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm','12am','1am','2am','3am','4am','5am'];
const PAGE_SIZE = 5;

const TIME_PERIODS = [
  { label: 'Día', startHour: 7, endHour: 11 },
  { label: 'Tarde', startHour: 12, endHour: 17 },
  { label: 'Noche', startHour: 18, endHour: 24 },
  { label: 'Todo el día', startHour: 0, endHour: 24 },
];

function makeGrid(cols: number): number[][] {
  return Array.from({ length: 24 }, () => Array(cols).fill(4));
}

const CELL_COLORS: Record<number, string> = {
  4: '#10B981',
  3: '#D1FAE5',
  2: '#FEF3C7',
  1: '#F97316',
  0: '#E5E7EB',
};

const CELL_LABELS: Record<number, string> = {
  4: '4/4',
  3: '3/4',
  2: '2/4',
  1: '1/4',
  0: '0/4',
};

const OPTIONS = [
  { day: 'Viernes 17 ene', time: '6:00 – 8:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Viernes 17 ene', time: '8:00 – 10:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Jueves 16 ene', time: '5:00 – 7:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Jueves 16 ene', time: '7:00 – 9:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Miércoles 15 ene', time: '7:00 – 9:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Miércoles 15 ene', time: '5:00 – 7:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
];

const STATUS_TEXT: Record<string, string> = {
  conectado: 'conectado ✓',
  esperando: 'esperando…',
  invitado: 'invitado',
};

const NAV_STEPS = [
  { key: 'crear', label: 'Plan', icon: '📋' },
  { key: 'invitar', label: 'Invitar', icon: '👥' },
  { key: 'conectar', label: 'Conectar', icon: '📅' },
  { key: 'heatmap', label: 'Calendario', icon: '⏰' },
  { key: 'confirmado', label: 'Resumen', icon: '📝' },
];
const MAIN_SCREENS = new Set(['crear', 'invitar', 'conectar', 'heatmap', 'blockout', 'mejores', 'confirmado']);

function TopNav({ title, onBack }: { title: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[navStyle.wrap, { paddingTop: insets.top }]}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={navStyle.backBtn}
      >
        <Text style={navStyle.back}>{'←'}</Text>
      </TouchableOpacity>
      <Text style={navStyle.title}>{title}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

export default function HomeScreen() {
  const [screen, setScreen] = useState('inicio');
  const [planName, setPlanName] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [durationIdx, setDurationIdx] = useState(0);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [customStartHour, setCustomStartHour] = useState(7);
  const [customEndHour, setCustomEndHour] = useState(11);
  const desdeCenterRef = useRef(7);
  const hastaCenterRef = useRef(11);
  const [, forceRender] = useState(0);
  const [groupSize, setGroupSize] = useState(2);
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const pickedDateRef = useRef(new Date());
  const [selectedOption, setSelectedOption] = useState<typeof OPTIONS[0] | null>(null);
  const [confirmedDay, setConfirmedDay] = useState('');
  const [confirmedTime, setConfirmedTime] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalDay, setModalDay] = useState('');
  const [modalTime, setModalTime] = useState('');

  const [roomCode, setRoomCode] = useState('');
  const [createdPlans, setCreatedPlans] = useState<{ code: string; name: string; fromDate: Date; toDate: Date; durationIdx: number; periodIdx: number; customStartHour: number; customEndHour: number; groupSize: number }[]>([]);
  const [joinInput, setJoinInput] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [participantsByRoom, setParticipantsByRoom] = useState<Record<string, Participant[]>>({});

  const participants = useMemo(() => participantsByRoom[roomCode] || [], [participantsByRoom, roomCode]);

  function addParticipant(code: string, p: Participant) {
    setParticipantsByRoom(prev => {
      const list = prev[code] || [];
      if (list.some(x => x.name === p.name)) return prev;
      return { ...prev, [code]: [...list, p] };
    });
  }

  function initParticipantsForRoom(code: string) {
    addParticipant(code, { name: 'Tú', initial: 'T', color: '#5B4FDB', bg: '#EEF2FF', status: 'conectado' });
  }

  const fetchedRef = useRef(false);
  const calendarConnected = useRef(false);
  const pendingAlert = useRef(false);
  const desdeRef = useRef<ScrollView>(null);
  const hastaRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (screen === 'heatmap' && pendingAlert.current) {
      pendingAlert.current = false;
      Alert.alert('Calendario conectado', 'Tus eventos se sincronizaron correctamente', [
        { text: 'Ver disponibilidad' },
      ]);
    }
  }, [screen]);

  useEffect(() => {
    if (!roomCode) return;
    const s = connectSocket();
    if (!s) return;
    const onUserJoined = ({ userId }: { userId: string }) => {
      addParticipant(roomCode, {
        name: userId === useAuthStore.getState().user?.id ? 'Tú' : `Usuario ${userId.slice(0, 4)}`,
        initial: (userId[0] || '?').toUpperCase(),
        color: '#10B981',
        bg: '#D1FAE5',
        status: 'conectado',
      });
    };
    s.on('user-joined', onUserJoined);
    return () => { s.off('user-joined', onUserJoined); };
  }, [roomCode]);

  useEffect(() => {
    if (screen !== 'crear') return;
    desdeCenterRef.current = customStartHour;
    hastaCenterRef.current = customEndHour;
    forceRender(n => n + 1);
    desdeRef.current?.scrollTo({ y: customStartHour * 36, animated: false });
    hastaRef.current?.scrollTo({ y: customEndHour * 36, animated: false });
  }, [screen, customStartHour, customEndHour]);

  const navCompleted: boolean[] = (() => {
    return NAV_STEPS.map(s => completedSteps.includes(s.key));
  })();

  function navigateToStep(key: string) {
    const idx = NAV_STEPS.findIndex(s => s.key === key);
    if (idx === -1) return;
    const prereq = [true, !!(planName && fromDate && toDate), !!roomCode, !!calendarConnected.current, !!confirmedDay];
    const canGo = idx === 0 || (idx > 0 && prereq.slice(1, idx + 1).every(Boolean)) || key === screen;
    if (canGo) {
      setScreen(key as 'crear' | 'invitar' | 'conectar' | 'heatmap' | 'confirmado' | 'blockout' | 'mejores' | 'inicio' | 'join');
    }
  }

  const [page, setPage] = useState(0);

  const dayColumns = useMemo(() => {
    if (!fromDate || !toDate) return [];
    const cols: { label: string; date: Date }[] = [];
    const cur = new Date(fromDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    while (cur <= end) {
      cols.push({ label: `${days[cur.getDay()]} ${cur.getDate()} ${months[cur.getMonth()]}`, date: new Date(cur) });
      cur.setDate(cur.getDate() + 1);
    }
    return cols;
  }, [fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(dayColumns.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const rawVisible = dayColumns.slice(safePage * PAGE_SIZE, (safePage * PAGE_SIZE) + PAGE_SIZE);
  const visibleColumns: ({ label: string; date: Date } | null)[] =
    rawVisible.length < PAGE_SIZE
      ? [...rawVisible, ...Array(PAGE_SIZE - rawVisible.length).fill(null)]
      : rawVisible;
  const colCount = Math.max(1, dayColumns.length);

  useEffect(() => { setPage(0); }, [fromDate, toDate]);

  useEffect(() => {
    setPage(0);
    if (screen === 'heatmap' && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchDeviceCalendarEvents();
    }
    if (screen !== 'heatmap') {
      fetchedRef.current = false;
    }
  }, [screen]);

  const [userGrid, setUserGrid] = useState<boolean[][]>([]);
  const [googleBusyGrid, setGoogleBusyGrid] = useState<boolean[][]>([]);

  useEffect(() => {
    if (!colCount) return;
    setUserGrid(prev => {
      if (prev.length === 24 && prev[0]?.length === colCount) return prev;
      return Array.from({ length: 24 }, () => Array(colCount).fill(false));
    });
    setGoogleBusyGrid(prev => {
      if (prev.length === 24 && prev[0]?.length === colCount) return prev;
      return Array.from({ length: 24 }, () => Array(colCount).fill(false));
    });
  }, [colCount]);

  function toggleUserCell(hourIdx: number, dayIdx: number) {
    setUserGrid(prev => {
      const next = prev.map(r => [...r]);
      next[hourIdx][dayIdx] = !next[hourIdx][dayIdx];
      return next;
    });
  }

  function getModifiedHeatmap(): number[][] {
    const base = makeGrid(colCount);
    return base.map((row, ri) =>
      row.map((v, ci) => {
        let val = v;
        if (userGrid[ri]?.[ci]) val = Math.max(0, val - 1);
        if (googleBusyGrid[ri]?.[ci]) val = Math.max(0, val - 1);
        return val;
      })
    );
  }

  async function fetchDeviceCalendarEvents() {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Calendar permission not granted');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      if (!calendars.length) {
        console.warn('No calendars found');
        return;
      }
      const calendarIds = calendars.map(c => c.id);

      const from = new Date();
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() + 60);
      to.setHours(23, 59, 59, 999);

      const events = await Calendar.getEventsAsync(calendarIds, from, to);

      const colDays = dayColumns.length ? dayColumns : [{ date: fromDate ?? new Date() }];
      const busy = Array.from({ length: 24 }, () => Array(colDays.length).fill(false));

      for (const ev of events) {
        if (ev.allDay) continue;
        const s = new Date(ev.startDate);
        const e = new Date(ev.endDate);
        const colIdx = colDays.findIndex(c => c.date.toDateString() === s.toDateString());
        if (colIdx === -1) continue;
        const startH = s.getHours() + s.getMinutes() / 60;
        const endH = e.getHours() + e.getMinutes() / 60;
        for (let ri = 0; ri < 24; ri++) {
          const slotStart = parseInt(HOURS[ri]);
          const slotEnd = slotStart + 1;
          if (startH < slotEnd && endH > slotStart) {
            busy[ri][colIdx] = true;
          }
        }
      }
      setGoogleBusyGrid(busy);
    } catch (err) {
      console.warn('Failed to read calendar events:', err);
    }
  }

  const MONTH_MAP: Record<string, number> = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
  };

  function parseDisplayToISO(day: string, time: string): { start: string; end: string } | null {
    const dc = day.replace(' de ', ' ').trim();
    const dp = dc.split(' ');
    const dn = parseInt(dp[dp.length - 2]);
    const mn = MONTH_MAP[dp[dp.length - 1]?.toLowerCase() ?? ''];
    if (isNaN(dn) || mn === undefined) return null;

    const tc = time.replace(/\s*·.*$/, '').trim();

    let m = tc.match(/(\d+):(\d+)\s+(AM|PM)\s*[–-]\s*(\d+):(\d+)\s+(AM|PM)/i);
    if (m) {
      const to24 = (h: number, a: string) => {
        const u = a.toUpperCase();
        if (u === 'PM' && h !== 12) return h + 12;
        if (u === 'AM' && h === 12) return 0;
        return h;
      };
      const y = (fromDate ?? new Date()).getFullYear();
      return {
        start: new Date(y, mn, dn, to24(+m[1], m[3]), +m[2]).toISOString(),
        end: new Date(y, mn, dn, to24(+m[4], m[6]), +m[5]).toISOString(),
      };
    }

    m = tc.match(/(\d+):(\d+)\s*[–-]\s*(\d+):(\d+)\s+(AM|PM)/i);
    if (m) {
      const a = m[5].toUpperCase();
      const to24 = (h: number) => {
        if (a === 'PM' && h !== 12) return h + 12;
        if (a === 'AM' && h === 12) return 0;
        return h;
      };
      const y = (fromDate ?? new Date()).getFullYear();
      return {
        start: new Date(y, mn, dn, to24(+m[1]), +m[2]).toISOString(),
        end: new Date(y, mn, dn, to24(+m[3]), +m[4]).toISOString(),
      };
    }

    return null;
  }

  const handleAddToGoogleCalendar = async () => {
    try {
      if (!useAuthStore.getState().isAuthenticated) {
        const user = await handleGoogleSignIn();
        if (!user) return;
      }

      const day = confirmedDay || selectedOption?.day;
      const time = confirmedTime || selectedOption?.time;
      if (!day || !time) {
        Alert.alert('Error', 'No hay un horario confirmado');
        return;
      }

      const parsed = parseDisplayToISO(day, time);
      if (!parsed) {
        Alert.alert('Error', 'No se pudo interpretar la fecha y hora');
        return;
      }

      const { htmlLink } = await calendarApi.createEvent({
        title: planName || 'Evento',
        description: `Plan: ${planName}\nDía: ${day}\nHorario: ${time}`,
        startTime: parsed.start,
        endTime: parsed.end,
      });

      Alert.alert('✅ Agregado a Google Calendar', '', [
        { text: 'Ver en Google', onPress: () => Linking.openURL(htmlLink) },
        { text: 'OK' },
      ]);
    } catch (error: any) {
      if (error?.message?.includes('No calendar connected')) {
        Alert.alert('Sin conexión', 'Conectá tu calendario primero desde la pantalla "Conectar"');
      } else {
        Alert.alert('Error', error?.message || 'No se pudo crear el evento');
      }
    }
  };

  function formatCellDay(colIdx: number): string {
    return dayColumns[colIdx]?.label ?? '';
  }

  function formatDateRange(): string {
    if (!fromDate || !toDate) return '';
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fd = `${days[fromDate.getDay()]} ${fromDate.getDate()} ${months[fromDate.getMonth()]}`;
    const td = `${days[toDate.getDay()]} ${toDate.getDate()} ${months[toDate.getMonth()]}`;
    return `${fd} - ${td} · ${TIME_PERIODS[periodIdx].label}`;
  }

  function formatCellTime(hourIdx: number): string {
    const start = parseInt(HOURS[hourIdx]);
    const end = customEndHour;
    const fmt = (h: number) => {
      const a = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${h12}:00 ${a}`;
    };
    return `${fmt(start)} – ${fmt(end)} · ${TIME_PERIODS[periodIdx].label}`;
  }

  const filteredRowIndices = useMemo(() => {
    const res: number[] = [];
    for (let ri = 0; ri < 24; ri++) {
      const h = parseInt(HOURS[ri]);
      if (h >= customStartHour && h < customEndHour) res.push(ri);
    }
    return res;
  }, [customStartHour, customEndHour]);

  let content;
  if (screen === 'inicio') {
    content = (
      <LinearGradient
        colors={['#3730A3', '#7C3AED', '#9D174D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s0.wrap}
      >
        <StatusBar style="light" />
        <View style={s0.center}>
          <View style={s0.logo}>
            <Text style={s0.logoText}>📅</Text>
          </View>
          <Text style={s0.title}>Calendario compartido</Text>
          <Text style={s0.subtitle}>
            Encuentra el momento perfecto{'\n'}para quedar con tu gente
          </Text>
        </View>
        <View style={s0.buttons}>
          <TouchableOpacity style={s0.primaryBtn} onPress={() => { setPlanName(''); setFromDate(null); setToDate(null); setCompletedSteps([]); setScreen('crear'); }}>
            <Text style={s0.primaryBtnText}>Crear un plan ✨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s0.ghostBtn} onPress={() => setScreen('join')}>
            <Text style={s0.ghostBtnText}>Tengo un código de invitación</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (screen === 'crear') {
    const formatDate = (d: Date) => {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    };

    const onDateChange = (_: DateTimePickerEvent, selected?: Date) => {
      if (!selected) return;
      setTempDate(selected);
      pickedDateRef.current = selected;
      if (Platform.OS === 'android') {
        if (showDatePicker === 'from') setFromDate(selected);
        if (showDatePicker === 'to') setToDate(selected);
        setShowDatePicker(null);
      }
    };

    content = (
      <View style={s1.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Nuevo plan" onBack={() => { setPlanName(''); setFromDate(null); setToDate(null); setScreen('inicio'); }} />
        <ScrollView style={s1.body} contentContainerStyle={s1.bodyContent} bounces={false}>
          <Text style={s1.sectionLabel}>Nuevo plan</Text>
          <Text style={s1.heading}>¿Cuál es el plan? 🎉</Text>
          <Text style={s1.sectionLabel}>Nombre del plan</Text>
          <TextInput
            style={s1.inputActive}
            value={planName}
            onChangeText={setPlanName}
            autoCapitalize="characters"
            autoCorrect={true}
            spellCheck={true}
            placeholder="Ej: CENA DE CUMPLEAÑOS 🎂"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={s1.sectionLabel}>¿Cuándo podría ser?</Text>
          <View style={s1.dateRow}>
            <TouchableOpacity style={s1.dateBox} onPress={() => {
              const d = new Date();
              pickedDateRef.current = d;
              setTempDate(d); setShowDatePicker('from');
            }}>
              <Text style={s1.dateLbl}>Desde</Text>
              <Text style={s1.dateVal}>{showDatePicker === 'from' ? formatDate(tempDate) : (fromDate ? formatDate(fromDate) : 'Elegir fecha')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s1.dateBox} onPress={() => {
              const d = new Date();
              pickedDateRef.current = d;
              setTempDate(d); setShowDatePicker('to');
            }}>
              <Text style={s1.dateLbl}>Hasta</Text>
              <Text style={s1.dateVal}>{showDatePicker === 'to' ? formatDate(tempDate) : (toDate ? formatDate(toDate) : 'Elegir fecha')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s1.sectionLabel}>Franja horaria</Text>
          <View style={s1.durRow}>
            {TIME_PERIODS.map((p, i) => (
              <TouchableOpacity
                key={p.label}
                style={[s1.durOpt, periodIdx === i && s1.durOptSel]}
                onPress={() => {
                  setPeriodIdx(i);
                  setCustomStartHour(p.startHour);
                  setCustomEndHour(p.endHour);
                }}
              >
                <Text style={[s1.durOptText, periodIdx === i && s1.durOptTextSel]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s1.hourPickerRow}>
            <View style={s1.hourPickerCol}>
              <Text style={s1.hourPickerLabel}>Desde</Text>
              <View style={s1.hourPickerFrame}>
                <ScrollView
                  ref={desdeRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={36}
                  decelerationRate="fast"
                  scrollEventThrottle={32}
                  contentOffset={{ x: 0, y: customStartHour * 36 }}
                  contentContainerStyle={s1.hourPickerContent}
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / 36);
                    const h = Math.min(23, Math.max(0, idx));
                    if (h !== desdeCenterRef.current) {
                      desdeCenterRef.current = h;
                      forceRender(n => n + 1);
                    }
                  }}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / 36);
                    const h = Math.min(23, Math.max(0, idx));
                    desdeCenterRef.current = h;
                    if (h !== customStartHour) {
                      setCustomStartHour(h);
                      if (h >= customEndHour) setCustomEndHour(h + 1);
                    }
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <View key={i} style={s1.hourPickerItem}>
                      <Text style={[
                        s1.hourPickerText,
                        i === desdeCenterRef.current && s1.hourPickerTextSel
                      ]}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={s1.hourPickerCol}>
              <Text style={s1.hourPickerLabel}>Hasta</Text>
              <View style={s1.hourPickerFrame}>
                <ScrollView
                  ref={hastaRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={36}
                  decelerationRate="fast"
                  scrollEventThrottle={32}
                  contentOffset={{ x: 0, y: customEndHour * 36 }}
                  contentContainerStyle={s1.hourPickerContent}
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / 36);
                    const h = Math.min(24, Math.max(0, idx));
                    if (h !== hastaCenterRef.current) {
                      hastaCenterRef.current = h;
                      forceRender(n => n + 1);
                    }
                  }}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / 36);
                    const h = Math.min(24, Math.max(customStartHour + 1, idx));
                    hastaCenterRef.current = h;
                    if (h !== customEndHour) setCustomEndHour(h);
                  }}
                >
                  {Array.from({ length: 25 }, (_, i) => (
                    <View key={i} style={s1.hourPickerItem}>
                      <Text style={[
                        s1.hourPickerText,
                        i === hastaCenterRef.current && s1.hourPickerTextSel
                      ]}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : i < 24 ? `${i - 12}:00 PM` : '12:00 AM'}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </ScrollView>
        {showDatePicker && (
          <View style={{ alignItems: 'center' }}>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onDateChange}
              minimumDate={showDatePicker === 'to' && fromDate ? fromDate : undefined}
              maximumDate={showDatePicker === 'from' && toDate ? toDate : undefined}
            />
          </View>
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <TouchableOpacity
            style={s1.pickerDone}
            onPress={() => {
              const d = pickedDateRef.current;
              if (showDatePicker === 'from') setFromDate(d);
              if (showDatePicker === 'to') setToDate(d);
              setShowDatePicker(null);
            }}
          >
            <Text style={s1.pickerDoneText}>Listo</Text>
          </TouchableOpacity>
        )}
        <View style={s1.bottom}>
          <TouchableOpacity style={s1.nextBtn} onPress={() => {
            if (!planName.trim()) {
              Alert.alert('Nombre del plan', 'Escribe un nombre para el plan');
              return;
            }
            if (!fromDate || !toDate) {
              Alert.alert('Fechas requeridas', 'Selecciona las fechas de inicio y fin');
              return;
            }
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            setRoomCode(code);
            setCreatedPlans(prev => [...prev, { code, name: planName, fromDate: new Date(fromDate), toDate: new Date(toDate), durationIdx, periodIdx, customStartHour, customEndHour, groupSize }]);
            initParticipantsForRoom(code);
            joinRoom(code);
            roomsApi.create({ name: planName }).catch(() => {});
            setScreen('invitar');
            setCompletedSteps(prev => [...prev, 'crear']);
          }}>
            <Text style={s1.nextBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'invitar') {
    content = (
      <View style={s2.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Invitar" onBack={() => setScreen('crear')} />
        <ScrollView style={s2.body} contentContainerStyle={s2.bodyContent} bounces={false}>
          <Text style={s2.heading}>Integrantes 👥</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>Comparte este código para que se unan al plan</Text>
          <View style={s2.linkCard}>
            <Text style={s2.linkCardLabel}>Código y enlace de invitación</Text>
            <View style={s2.linkRow}>
              <Text style={s2.linkText} numberOfLines={1}>{roomCode}</Text>
            </View>
            <View style={s2.linkRow}>
                <Text style={s2.linkText} numberOfLines={1}>http://miapp.com/unirse/{roomCode}</Text>
              <TouchableOpacity
                style={s2.copyBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(`🔑 Código del plan: *${roomCode}*\n\nhttp://miapp.com/unirse/${roomCode}`);
                  Alert.alert('Copiado', 'Código y enlace copiados');
                }}
              >
                <Text style={s2.copyBtnText}>Copiar</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12, marginTop: 8 }}>Comparte el código con tus amigos:</Text>
          <View style={s2.shareRow}>
            {[
              { icon: '💬', label: 'WhatsApp', isWa: true },
              { icon: '📱', label: 'Mensaje' },
              { icon: '📧', label: 'Email', isEmail: true },
            ].map((s) => (
              <TouchableOpacity key={s.label} style={s2.shareBtn} onPress={async () => {
                const codigo = roomCode;
                if (s.isEmail) {
                  const subject = encodeURIComponent('Te invito a un plan en MiApp');
                  const body = encodeURIComponent(`🔑 Código del plan: ${codigo}\n\nhttps://cuando.app/plan/abc123`);
                  await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
                } else {
                  const msg = s.isWa
                    ? `🔑 Código del plan: *${codigo}*\n\ncuando.app/plan/abc123`
                    : `🔑 Código del plan: ${codigo}\n\nhttps://cuando.app/plan/abc123`;
                  await Share.share({ message: msg });
                }
              }}>
                <Text style={s2.shareIcon}>{s.icon}</Text>
                <Text style={s2.shareLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s2.peopleTitle}>Personas unidas · {participants.length}/{groupSize}</Text>
          {participants.map((p) => (
            <View key={p.name} style={s2.personRow}>
              <View style={[s2.avatar, { backgroundColor: p.bg }]}>
                <Text style={[s2.avatarText, { color: p.color }]}>{p.initial}</Text>
              </View>
              <Text style={s2.personName}>{p.name}</Text>
              <Text style={[s2.personStatus, { color: p.status === 'conectado' ? '#10B981' : '#9CA3AF' }]}>
                {STATUS_TEXT[p.status]}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={s2.bottom}>
          <TouchableOpacity style={s2.nextBtn} onPress={() => { setScreen('conectar'); setCompletedSteps(prev => [...prev, 'invitar']); }}>
            <Text style={s2.nextBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'conectar') {
    content = (
      <View style={s3.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Conectar" onBack={() => setScreen('invitar')} />
        <View style={s3.bodyTop}>
          <View style={s3.calIcon}>
            <Text style={{ fontSize: 44 }}>📅</Text>
          </View>
          <Text style={s3.title}>Conecta tu calendario</Text>
          <Text style={s3.subtitle}>
            Solo vemos cuándo estás ocupada.{'\n'}
            <Text style={{ color: '#10B981', fontWeight: '700' }}>
              Solo creamos eventos cuando vos lo decidas.
            </Text>
          </Text>
          <View style={s3.privacyList}>
            {[
              { icon: '📅', text: 'Sincroniza tu calendario automáticamente' },
              { icon: '🔒', text: 'Solo lectura — sin cambios' },
              { icon: '👁️', text: 'El grupo solo ve libre / ocupado' },
            ].map((item) => (
              <View key={item.text} style={s3.privacyItem}>
                <Text style={s3.privacyIcon}>{item.icon}</Text>
                <Text style={s3.privacyText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s3.bottomBtns}>
          <TouchableOpacity style={s3.googleBtn} onPress={async () => {
            const { status } = await Calendar.requestCalendarPermissionsAsync();
            if (status === 'granted') {
              await fetchDeviceCalendarEvents();
              calendarConnected.current = true;
              setCompletedSteps(prev => [...prev, 'conectar']);
              pendingAlert.current = true;
              setScreen('heatmap');
            }
          }}>
            <Text style={{ fontSize: 14 }}>📆</Text>
            <Text style={s3.googleText}> Conectar calendario</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s3.manualBtn} onPress={() => setScreen('blockout')}>
            <Text style={s3.manualBtnText}>Poner mis horarios manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'join') {
    content = (
      <View style={[s2.wrap, { justifyContent: 'center', paddingBottom: 40 }]}>
        <StatusBar style="dark" />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <TopNav title="Unirse" onBack={() => setScreen('inicio')} />
        </View>
        <View style={{ padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#11181C' }}>Unirse a un Plan</Text>
          <Text style={{ fontSize: 16, color: '#687076', textAlign: 'center' }}>Ingresa tu nombre y el código que te compartieron</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 8, letterSpacing: 0.6 }}>Nombre</Text>
          <TextInput
            style={{
              width: '100%', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 12,
              padding: 16, fontSize: 18, color: '#11181C', textAlign: 'center',
            }}
            placeholder="Tu nombre"
            value={joinName}
            onChangeText={setJoinName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.6 }}>Código del plan</Text>
          <TextInput
            style={{
              width: '100%', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 12,
              padding: 16, fontSize: 20, color: '#11181C', textAlign: 'center', letterSpacing: 4,
            }}
            placeholder="Ej: A1B2C3"
            value={joinInput}
            onChangeText={setJoinInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={{ width: '100%', backgroundColor: '#5B4FDB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 }}
            disabled={joining}
            onPress={async () => {
              if (!joinName.trim()) {
                Alert.alert('Nombre requerido', 'Ingresa tu nombre');
                return;
              }
              if (!joinInput.trim()) {
                Alert.alert('Código requerido', 'Ingresa el código del plan');
                return;
              }
              setJoining(true);
              const code = joinInput.trim().toUpperCase();
              const match = createdPlans.find(p => p.code === code);
              if (match) {
                setPlanName(match.name);
                setFromDate(match.fromDate);
                setToDate(match.toDate);
                setDurationIdx(match.durationIdx);
                setPeriodIdx(match.periodIdx ?? 3);
                setCustomStartHour(match.customStartHour ?? TIME_PERIODS[match.periodIdx ?? 3].startHour);
                setCustomEndHour(match.customEndHour ?? TIME_PERIODS[match.periodIdx ?? 3].endHour);
                setGroupSize(match.groupSize);
                setRoomCode(code);
                joinRoom(code);
                const name = joinName.trim();
                addParticipant(code, {
                  name,
                  initial: name[0].toUpperCase(),
                  color: '#F59E0B', bg: '#FEF3C7', status: 'conectado',
                });
                setJoining(false);
                setJoinInput('');
                setJoinName('');
                setScreen('invitar');
              } else {
                setJoining(false);
                Alert.alert('No encontrado', 'No hay un plan con ese código');
              }
            }}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
              {joining ? 'Buscando...' : 'Unirse'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'blockout') {
    content = (
      <View style={s7.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Mis horarios" onBack={() => setScreen('conectar')} />
        <View style={s7.header}>
          <Text style={s7.title}>Toca las horas que NO puedes ⛔</Text>
          <Text style={s7.subtitle}>Así aparecerán como ocupadas en tu disponibilidad</Text>
        </View>
        <View style={s7.gridContainer}>
          <View style={s7.paginationRow}>
            <TouchableOpacity
              disabled={safePage === 0}
              onPress={() => setPage(p => Math.max(0, p - 1))}
            >
              <Text style={[s7.pageArrow, safePage === 0 && { opacity: 0.3 }]}>{'◀'}</Text>
            </TouchableOpacity>
            <Text style={s7.pageText}>{safePage + 1}/{totalPages}</Text>
            <TouchableOpacity
              disabled={safePage >= totalPages - 1}
              onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              <Text style={[s7.pageArrow, safePage >= totalPages - 1 && { opacity: 0.3 }]}>{'▶'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s7.gridScoreRow}>
            <View style={{ width: 38 }} />
            {visibleColumns.map((col, i) => (
              <View key={i} style={s7.dayCell}>
                <Text style={[s7.scoreText, !col && { color: '#D1D5DB' }]}>
                  {col ? `${col.date.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][col.date.getMonth()]}` : '—'}
                </Text>
              </View>
            ))}
          </View>
          <View style={s7.gridHeader}>
            <View style={{ width: 38 }} />
            {visibleColumns.map((col, i) => (
              <View key={i} style={s7.dayCell}>
                <Text style={[s7.dayLabel, !col && { color: '#D1D5DB' }]}>{col ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][col.date.getDay()] : '·'}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ flex: 1 }} bounces={false}>
          <View style={s7.heatGrid}>
            {filteredRowIndices.map(ri => (
              <View key={ri} style={s7.heatRow}>
                <View style={s7.hourCell}>
                  <Text style={s7.hourLabel}>{DISPLAY_HOURS[ri]}</Text>
                </View>
                {visibleColumns.map((col, ci) => {
                  if (!col) {
                    return (
                      <View key={ci} style={[s7.heatCell, { backgroundColor: '#F3F4F6', borderColor: '#F3F4F6' }]}>
                        <Text style={s7.cellX}>—</Text>
                      </View>
                    );
                  }
                  const blocked = userGrid[ri]?.[safePage * PAGE_SIZE + ci] ?? false;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[s7.heatCell, {
                        backgroundColor: blocked ? '#DC2626' : '#F9FAFB',
                        borderColor: blocked ? '#DC2626' : '#E5E7EB',
                      }]}
                      onPress={() => toggleUserCell(ri, safePage * PAGE_SIZE + ci)}
                    >
                      {blocked && <Text style={s7.cellX}>✕</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        </View>
        <View style={s7.legend}>
          <View style={s7.legendItem}>
            <View style={[s7.legendDot, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1 }]} />
            <Text style={s7.legendLabel}>Disponible</Text>
          </View>
          <View style={s7.legendItem}>
            <View style={[s7.legendDot, { backgroundColor: '#DC2626' }]} />
            <Text style={s7.legendLabel}>Ocupado</Text>
          </View>
        </View>
        <View style={s7.bottom}>
          <TouchableOpacity style={s7.saveBtn} onPress={() => setScreen('heatmap')}>
            <Text style={s7.saveBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'heatmap') {
    const modifiedHeatmap = getModifiedHeatmap();
    content = (
      <View style={s4.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Disponibilidad" onBack={() => setScreen('conectar')} />
        <View style={s4.header}>
          <View>
            <Text style={s4.heatTitle}>Disponibilidad</Text>
            <Text style={s4.heatSub}>{formatDateRange()}</Text>
          </View>
          <View style={s4.avatarsRow}>
            {(participants.length ? participants : PEOPLE.slice(0, 4)).map((p, i) => (
              <View key={p.name} style={[s4.avaSm, {
                backgroundColor: p.bg,
                marginLeft: i > 0 ? -6 : 0,
              }]}>
                <Text style={[s4.avaSmText, { color: p.color }]}>{p.initial}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s4.gridContainer}>
          <View style={s4.paginationRow}>
            <TouchableOpacity
              disabled={safePage === 0}
              onPress={() => setPage(p => Math.max(0, p - 1))}
            >
              <Text style={[s4.pageArrow, safePage === 0 && { opacity: 0.3 }]}>{'◀'}</Text>
            </TouchableOpacity>
            <Text style={s4.pageText}>{safePage + 1}/{totalPages}</Text>
            <TouchableOpacity
              disabled={safePage >= totalPages - 1}
              onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              <Text style={[s4.pageArrow, safePage >= totalPages - 1 && { opacity: 0.3 }]}>{'▶'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s4.gridScoreRow}>
            <View style={{ width: 38 }} />
            {visibleColumns.map((col, ci) => (
              <View key={ci} style={s4.dayCell}>
                <Text style={[s4.scoreText, !col && { color: '#D1D5DB' }]}>
                  {col ? `${col.date.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][col.date.getMonth()]}` : '—'}
                </Text>
              </View>
            ))}
          </View>
          <View style={s4.gridHeader}>
            <View style={{ width: 38 }} />
            {visibleColumns.map((col, ci) => (
              <View key={ci} style={s4.dayCell}>
                <Text style={[s4.dayLabel, !col && { color: '#D1D5DB' }]}>
                  {col ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][col.date.getDay()] : '·'}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView style={s4.heatGridScroll} bounces={false}>
            <View style={s4.heatGrid}>
              {filteredRowIndices.map(ri => (
                <View key={ri} style={s4.heatRow}>
                  <View style={s4.hourCell}>
                    <Text style={s4.hourLabel}>{DISPLAY_HOURS[ri]}</Text>
                  </View>
                  {visibleColumns.map((col, vi) => {
                    if (!col) {
                      return (
                        <View key={vi} style={[s4.heatCell, { backgroundColor: '#F3F4F6' }]}>
                          <Text style={[s4.cellLabel, { color: '#D1D5DB' }]}>—</Text>
                        </View>
                      );
                    }
                    const absCi = safePage * PAGE_SIZE + vi;
                    const v = modifiedHeatmap[ri]?.[absCi] ?? 4;
                    return (
                      <TouchableOpacity
                        key={vi}
                        style={[s4.heatCell, { backgroundColor: CELL_COLORS[Math.floor(v)] }]}
                        onPress={() => {
                          setModalDay(formatCellDay(absCi));
                          setModalTime(formatCellTime(ri));
                          setShowModal(true);
                        }}
                      >
                        <Text style={[s4.cellLabel, {
                          color: v >= 3 ? '#065F46' : v >= 2 ? '#92400E' : '#9CA3AF',
                        }]}>
                          {CELL_LABELS[Math.floor(v)]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
          </View>
        </ScrollView>
        </View>
        <View style={s4.legend}>
          {[
            { color: '#10B981', label: '4/4' },
            { color: '#D1FAE5', label: '3/4' },
            { color: '#FEF3C7', label: '2/4' },
            { color: '#E5E7EB', label: '0/4' },
          ].map((l) => (
            <View key={l.label} style={s4.legendItem}>
              <View style={[s4.legendDot, { backgroundColor: l.color }]} />
              <Text style={s4.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s4.editBlockBtn} onPress={() => setScreen('blockout')}>
          <Text style={s4.editBlockBtnText}>
            {userGrid.some(r => r.some(c => c)) ? 'Editar horarios ocupados ✏️' : 'Agregar horarios ocupados ✏️'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s4.actionBtn} onPress={() => setScreen('mejores')}>
          <Text style={s4.actionBtnText}>Horarios recomendados ✨</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'mejores') {
    const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const filteredOptions = OPTIONS.filter(o => o.count === 4);
    const groups: Record<string, typeof OPTIONS> = {};
    filteredOptions.forEach(o => {
      if (!groups[o.day]) groups[o.day] = [];
      groups[o.day].push(o);
    });
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
      const pa = a.split(' '), pb = b.split(' ');
      return (MONTHS.indexOf(pa[2]) * 100 + parseInt(pa[1])) - (MONTHS.indexOf(pb[2]) * 100 + parseInt(pb[1]));
    });
    content = (
      <View style={s5.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Mejores horarios" onBack={() => setScreen('heatmap')} />
        <ScrollView style={s5.body} contentContainerStyle={s5.bodyContent} bounces={false}>
          <Text style={s5.title}>Mejores opciones ✨</Text>
          <Text style={s5.subtitle}>Todos disponibles</Text>
          {sortedGroups.map(([dayLabel, options]) => (
            <View key={dayLabel}>
              <View style={s5.sectionHeader}>
                <View style={s5.sectionLine} />
                <Text style={s5.sectionText}>{dayLabel}</Text>
                <View style={s5.sectionLine} />
              </View>
              {options.map((o, i) => {
                const selected = selectedOption === o;
                return (
                  <TouchableOpacity
                    key={`${o.day}-${o.time}`}
                    style={[s5.card, {
                      backgroundColor: o.bg,
                      borderColor: selected ? o.color : o.color + '30',
                      borderWidth: selected ? 2.5 : 1.5,
                    }]}
                    onPress={() => setSelectedOption(o)}
                  >
                    <View style={s5.cardTop}>
                      <View>
                        <Text style={s5.cardTime}>{o.time}</Text>
                      </View>
                      <View style={[s5.badge, { backgroundColor: o.color }]}>
                        <Text style={s5.badgeText}>{o.count}/4</Text>
                      </View>
                    </View>
                    <View style={s5.cardBottom}>
                      <View style={s5.avatarsRow}>
                        {PEOPLE.slice(0, o.count).map((p, j) => (
                          <View key={p.name} style={[s5.avaSm, {
                            backgroundColor: p.bg,
                            marginLeft: j > 0 ? -6 : 0,
                          }]}>
                            <Text style={[s5.avaSmText, { color: p.color }]}>{p.initial}</Text>
                          </View>
                        ))}
                      </View>
                      {selected ? (
                        <TouchableOpacity
                          style={[s5.chooseBtn, { backgroundColor: o.color }]}
                          onPress={() => {
                            setModalDay(o.day);
                            setModalTime(o.time);
                            setShowModal(true);
                          }}
                        >
                          <Text style={s5.chooseBtnText}>Elegir este ✓</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[s5.canText, { color: o.color }]}>{o.count}/4 disponibles</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (screen === 'confirmado') {
    content = (
      <View style={s6.wrap}>
        <StatusBar style="dark" />
          <TopNav title="Confirmado" onBack={() => setScreen('heatmap')} />
        <ScrollView style={s6.body} contentContainerStyle={s6.bodyContent} bounces={false}>
          <View style={s6.successIcon}>
            <Text style={{ fontSize: 34 }}>✅</Text>
          </View>
          <Text style={s6.title}>¡Plan confirmado!</Text>
          <Text style={s6.subtitle}>Ya saben cuándo se van a ver</Text>
          <View style={s6.confirmCard}>
            <Text style={s6.cardLbl}>Plan</Text>
            <Text style={s6.cardName}>{planName}</Text>
            <View style={s6.dateRow}>
              <View style={s6.dateIcon}>
                <Text style={{ fontSize: 18 }}>📅</Text>
              </View>
              <View>
                <Text style={s6.dateVal}>{confirmedDay || selectedOption?.day || 'Miércoles 15 de enero'}</Text>
                <Text style={s6.timeVal}>{confirmedTime || selectedOption?.time || '7:00 PM – 9:00 PM · 2 horas'}</Text>
              </View>
            </View>
            <Text style={s6.attendLbl}>Asistentes</Text>
            <View style={s6.attendRow}>
              {(participants.length ? participants : PEOPLE.slice(0, 4)).map((p) => (
                <View key={p.name} style={s6.attendPerson}>
                  <View style={[s6.attendAva, { backgroundColor: p.bg }]}>
                    <Text style={[s6.attendAvaText, { color: p.color }]}>{p.initial}</Text>
                  </View>
                  <Text style={s6.attendName}>
                    {p.name === 'Tú' ? (useAuthStore.getState().user?.name || 'Tú') : p.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={s6.bottom}>
          <TouchableOpacity style={s6.gcalBtn} onPress={handleAddToGoogleCalendar}>
            <Text style={s6.gcalBtnText}>Agregar a Google Calendar 📅</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s6.shareBtn} onPress={async () => {
            const dia = confirmedDay || 'Por confirmar';
            const hora = confirmedTime || 'A definir';
            const texto = `🎉 *${planName}*\n📅 ${dia}\n⏰ ${hora}\n\n👇 Únete con el código: PLAN-A1B2\n\n✨ Hecho con MiApp`;
            await Share.share({ message: texto });
          }}>
            <Text style={s6.shareBtnText}>Compartir con el grupo 💬</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const navBar = MAIN_SCREENS.has(screen) && (
    <View style={navStyle.bar}>
      {NAV_STEPS.map((step, i) => {
        const isCurrent = step.key === screen;
        const isDone = navCompleted[i];
        const prereq = [true, !!(planName && fromDate && toDate), !!roomCode, !!calendarConnected.current, !!confirmedDay];
        const canGo = i === 0 || (i > 0 && prereq.slice(1, i + 1).every(Boolean)) || isCurrent;
        return (
          <TouchableOpacity
            key={step.key}
            style={[navStyle.item, !canGo && { opacity: 0.35 }]}
            activeOpacity={canGo ? 0.6 : 1}
            onPress={() => { if (canGo) navigateToStep(step.key); }}
          >
            <View style={[navStyle.dot, isCurrent && navStyle.dotCurrent, isDone && !isCurrent && navStyle.dotDone]}>
              <Text style={navStyle.dotIcon}>{step.icon}</Text>
              {isDone && (
                <View style={navStyle.checkBadge}>
                  <Text style={navStyle.checkText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={[navStyle.label, isCurrent && navStyle.labelCurrent, !canGo && navStyle.labelMuted]}>
              {step.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {content}
      </View>
      {navBar}
      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={modalStyle.overlay}>
          <View style={modalStyle.card}>
            <Text style={modalStyle.title}>¿Confirmar fecha?</Text>
            <Text style={modalStyle.subtitle}>¿Quieres seleccionar esta fecha?</Text>
            <View style={modalStyle.dateContainer}>
              <Text style={modalStyle.dateDay}>{modalDay}</Text>
              <Text style={modalStyle.dateTime}>{modalTime}</Text>
            </View>
            <View style={modalStyle.btnRow}>
              <TouchableOpacity
                style={modalStyle.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={modalStyle.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modalStyle.confirmBtn}
                onPress={() => {
                  setConfirmedDay(modalDay);
                  setConfirmedTime(modalTime);
                  setShowModal(false);
                  setCompletedSteps(prev => [...prev, 'heatmap']);
                  setScreen('confirmado');
                }}
              >
                <Text style={modalStyle.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const navStyle = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    fontSize: 22,
    color: '#5B4FDB',
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-evenly',
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  item: {
    alignItems: 'center',
    gap: 4,
    width: 56,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: {
    backgroundColor: '#EEF2FF',
  },
  dotDone: {
    backgroundColor: '#D1FAE5',
  },
  dotIcon: {
    fontSize: 14,
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  checkText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  labelCurrent: {
    color: '#5B4FDB',
    fontWeight: '700',
  },
  labelMuted: {
    color: '#D1D5DB',
  },
});

const s0 = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoText: {
    fontSize: 44,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
    marginBottom: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 28,
  },
  buttons: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#5B4FDB',
    fontSize: 18,
    fontWeight: '700',
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ghostBtnText: {
    color: '#fff',
    fontSize: 17,
  },
});

const s1 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginTop: 14,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  inputActive: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#5B4FDB',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    height: 58,
    fontFamily: 'Arial',
    letterSpacing: 0,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
  },
  dateLbl: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateVal: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  durRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durOpt: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  durOptSel: {
    backgroundColor: '#5B4FDB',
  },
  durOptText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  durOptTextSel: {
    color: '#fff',
    fontWeight: '700',
  },
  bottom: {
    padding: 24,
    paddingBottom: 12,
  },
  nextBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  pickerDone: {
    backgroundColor: '#5B4FDB',
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  pickerDoneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  hourPickerRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },
  hourPickerCol: {
    flex: 1,
    alignItems: 'center',
  },
  hourPickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hourPickerFrame: {
    height: 180,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  hourPickerContent: {
    paddingTop: 72,
    paddingBottom: 72,
  },
  hourPickerItem: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourPickerText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  hourPickerTextSel: {
    fontSize: 17,
    color: '#1E1B4B',
    fontWeight: '600',
  },
});

const s2 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    flexGrow: 1,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  linkCard: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(91,79,219,0.15)',
    borderRadius: 18,
    padding: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  linkCardLabel: {
    fontSize: 13,
    color: '#5B4FDB',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkText: {
    fontSize: 15,
    color: '#6B7280',
    flex: 1,
  },
  copyBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  copyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  shareLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  peopleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  personName: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  personStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottom: {
    padding: 24,
    paddingBottom: 12,
  },
  nextBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

const s3 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bodyTop: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    alignItems: 'center',
  },
  calIcon: {
    width: 110,
    height: 110,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 28,
  },
  privacyList: {
    width: '100%',
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  privacyIcon: {
    fontSize: 16,
    width: 22,
  },
  privacyText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  bottomBtns: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  googleG: {
    fontWeight: '700',
    fontSize: 18,
    color: '#4285F4',
  },
  googleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  manualBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  manualBtnText: {
    fontSize: 15,
    color: '#6B7280',
  },
});

const s4 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  heatTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  heatSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  avatarsRow: {
    flexDirection: 'row',
  },
  avaSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaSmText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gridContainer: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 17,
  },
  heatGridScroll: {
    flex: 1,
  },
  gridScoreRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  gridHeader: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  heatGrid: {
    gap: 3,
    paddingBottom: 0,
  },
  heatRow: {
    flexDirection: 'row',
    gap: 3,
    height: 32,
  },
  hourCell: {
    width: 38,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingRight: 4,
    paddingTop: 2,
  },
  hourLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  heatCell: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 0,
    marginBottom: 6,
  },
  pageArrow: {
    fontSize: 18,
    color: '#5B4FDB',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    minWidth: 36,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 16,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  editBlockBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 12,
  },
  editBlockBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});

const s5 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 12,
  },
  card: {
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 28,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardDay: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  cardTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarsRow: {
    flexDirection: 'row',
  },
  avaSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  avaSmText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chooseBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  chooseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  canText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

const s6 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    alignItems: 'center',
    padding: 24,
    flexGrow: 1,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 22,
  },
  confirmCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    marginBottom: 18,
  },
  cardLbl: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  cardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 18,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  dateIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  timeVal: {
    fontSize: 14,
    color: '#6B7280',
  },
  attendLbl: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  attendRow: {
    flexDirection: 'row',
    gap: 14,
  },
  attendPerson: {
    alignItems: 'center',
  },
  attendAva: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  attendAvaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  attendName: {
    fontSize: 12,
    color: '#6B7280',
  },
  bottom: {
    padding: 24,
    paddingBottom: 12,
    gap: 12,
  },
  gcalBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  gcalBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  shareBtn: {
    backgroundColor: '#D1FAE5',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
   shareBtnText: {
      color: '#10B981',
      fontSize: 16,
      fontWeight: '700',
    },
  });

const s7 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  gridContainer: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 0,
    paddingLeft: 8,
    paddingRight: 17,
  },
  gridScoreRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  gridHeader: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  heatGrid: {
    gap: 3,
    paddingBottom: 0,
  },
  heatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
    height: 32,
  },
  hourCell: {
    width: 38,
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingTop: 2,
  },
  hourLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  heatCell: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellX: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 0,
    marginBottom: 6,
  },
  pageArrow: {
    fontSize: 18,
    color: '#5B4FDB',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    minWidth: 36,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  bottom: {
    padding: 24,
    paddingBottom: 12,
    marginTop: 'auto',
  },
  saveBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

const modalStyle = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  dateTime: {
    fontSize: 15,
    color: '#6B7280',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#5B4FDB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
