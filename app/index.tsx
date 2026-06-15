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

const AVATAR_COLORS = [
  { color: '#DB2777', bg: '#FCE7F3' },
  { color: '#F59E0B', bg: '#FEF3C7' },
  { color: '#10B981', bg: '#D1FAE5' },
  { color: '#F97316', bg: '#FED7AA' },
  { color: '#8B5CF6', bg: '#EDE9FE' },
  { color: '#14B8A6', bg: '#CCFBF1' },
  { color: '#EF4444', bg: '#FEE2E2' },
  { color: '#3B82F6', bg: '#DBEAFE' },
];

const PEOPLE = [
  { initial: 'T', name: 'Tú', color: '#8B7CF6', bg: '#EEF2FF' },
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


const DARK = {
  bg: '#121212',
  card: '#1a1a1a',
  elevated: '#252525',
  border: '#333333',
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#73777c',
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
  { key: 'invitar', label: 'Integrantes', icon: '👥' },
  { key: 'heatmap', label: 'Calendario', icon: '⏰' },
  { key: 'confirmado', label: 'Resumen', icon: '📝' },
];
const MAIN_SCREENS = new Set(['crear', 'invitar', 'heatmap', 'blockout', 'mejores', 'confirmado']);

function TopNav({ title, onBack, darkMode, onToggleDark }: { title: string; onBack: () => void; darkMode?: boolean; onToggleDark?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[navStyle.wrap, { paddingTop: insets.top, backgroundColor: darkMode ? DARK.bg : '#fff', borderBottomColor: darkMode ? DARK.border : '#E5E7EB' }]}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={navStyle.backBtn}
      >
        <Text style={[navStyle.back, { color: darkMode ? DARK.text : '#111827' }]}>{'←'}</Text>
      </TouchableOpacity>
      <Text style={[navStyle.title, { color: darkMode ? DARK.text : '#111827' }]}>{title}</Text>
      <TouchableOpacity
        onPress={onToggleDark}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={navStyle.backBtn}
      >
        <Text style={{ fontSize: 20 }}>{darkMode ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const [screen, setScreen] = useState('inicio');
  const [planName, setPlanName] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [durationIdx, setDurationIdx] = useState(0);
  const [periodIdx, setPeriodIdx] = useState(-1);
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
  const [customColors, setCustomColors] = useState<Record<string, { color: string; bg: string }>>({});
  const [editingColorIdx, setEditingColorIdx] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  const participants = useMemo(() => participantsByRoom[roomCode] || [], [participantsByRoom, roomCode]);

  const participantsByRoomRef = useRef(participantsByRoom);
  participantsByRoomRef.current = participantsByRoom;
  const customColorsRef = useRef(customColors);
  customColorsRef.current = customColors;

  function getUnusedColor(code: string) {
    const used = new Set<string>();
    const list = participantsByRoomRef.current[code] || [];
    list.forEach((p, i) => {
      const custom = customColorsRef.current[p.name];
      const ac = custom || (i === 0 ? { color: '#8B7CF6', bg: '#EEF2FF' } : AVATAR_COLORS[(i - 1) % AVATAR_COLORS.length]);
      used.add(ac.color);
    });
    const ALL = [{ color: '#8B7CF6', bg: '#EEF2FF' }, ...AVATAR_COLORS];
    return ALL.find(c => !used.has(c.color)) || ALL[0];
  }

  function addParticipant(code: string, p: Participant) {
    setParticipantsByRoom(prev => {
      const list = prev[code] || [];
      if (list.some(x => x.name === p.name)) return prev;
      return { ...prev, [code]: [...list, p] };
    });
  }

  function initParticipantsForRoom(code: string) {
    addParticipant(code, { name: 'Tú', initial: 'T', color: '#8B7CF6', bg: '#EEF2FF', status: 'conectado' });
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
      const ac = getUnusedColor(roomCode);
      addParticipant(roomCode, {
        name: userId === useAuthStore.getState().user?.id ? 'Tú' : `Usuario ${userId.slice(0, 4)}`,
        initial: (userId[0] || '?').toUpperCase(),
        color: ac.color, bg: ac.bg, status: 'conectado',
      });
    };
    s.on('user-joined', onUserJoined);
    return () => { s.off('user-joined', onUserJoined); };
  }, [roomCode]);

  useEffect(() => {
    if (screen !== 'crear' || periodIdx < 0) return;
    desdeCenterRef.current = customStartHour;
    hastaCenterRef.current = customEndHour;
    forceRender(n => n + 1);
    desdeRef.current?.scrollTo({ y: customStartHour * 36, animated: false });
    hastaRef.current?.scrollTo({ y: customEndHour * 36, animated: false });
  }, [screen, customStartHour, customEndHour, periodIdx]);

  const navCompleted: boolean[] = (() => {
    return NAV_STEPS.map(s => completedSteps.includes(s.key));
  })();

  function navigateToStep(key: string) {
    const idx = NAV_STEPS.findIndex(s => s.key === key);
    if (idx === -1) return;
    const prereq = [true, !!roomCode, !!calendarConnected.current, !!confirmedDay];
    const canGo = idx === 0 || (idx > 0 && prereq.slice(1, idx + 1).every(Boolean)) || key === screen;
    if (canGo) {
      setScreen(key as 'crear' | 'invitar' | 'heatmap' | 'confirmado' | 'blockout' | 'mejores' | 'inicio' | 'join');
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
    const cols = colCount;
    const grid = Array.from({ length: 24 }, () => Array(cols).fill(0));
    for (let ri = 0; ri < 24; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        if (!userGrid[ri]?.[ci] && !googleBusyGrid[ri]?.[ci]) {
          grid[ri][ci]++;
        }
      }
    }
    return grid;
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
    return `${fd} - ${td}${periodIdx >= 0 ? ` · ${TIME_PERIODS[periodIdx].label}` : ''}`;
  }

  function formatCellTime(hourIdx: number): string {
    const start = parseInt(HOURS[hourIdx]);
    const end = customEndHour;
    const fmt = (h: number) => {
      const a = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${h12}:00 ${a}`;
    };
    return `${fmt(start)} – ${fmt(end)}`;
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
      <View style={[s0.wrap, { backgroundColor: darkMode ? DARK.bg : '#fff', justifyContent: 'space-between' }]}>
        <StatusBar style="light" />
        <View style={{ position: 'absolute', top: 50, right: 16, zIndex: 10 }}>
          <TouchableOpacity onPress={() => setDarkMode(!darkMode)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={navStyle.backBtn}>
            <Text style={{ fontSize: 22 }}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
        <View style={s0.center}>
          <View style={[s0.logo, darkMode ? {} : { backgroundColor: 'rgba(139,124,246,0.1)', borderColor: 'rgba(139,124,246,0.25)' }]}>
            <Text style={s0.logoText}>📅</Text>
          </View>
          <Text style={[s0.title, { color: darkMode ? '#cccccc' : '#111827' }]}>Calendario compartido</Text>
          <Text style={[s0.subtitle, { color: darkMode ? 'rgba(255,255,255,0.65)' : '#6B7280' }]}>
            Encuentra el momento perfecto{'\n'}para quedar con tu gente
          </Text>
        </View>
        <View style={s0.buttons}>
          <TouchableOpacity style={[s0.primaryBtn, { backgroundColor: '#8B7CF6' }]} onPress={() => { setPlanName(''); setFromDate(null); setToDate(null); setPeriodIdx(-1); setCustomStartHour(7); setCustomEndHour(11); setCompletedSteps([]); setRoomCode(''); setConfirmedDay(''); setConfirmedTime(''); calendarConnected.current = false; setScreen('crear'); }}>
            <Text style={[s0.primaryBtnText, { color: '#fff' }]}>Crear un plan ✨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s0.ghostBtn, darkMode ? { backgroundColor: 'rgba(255,255,255,0.05)' } : { backgroundColor: 'rgba(139,124,246,0.05)', borderColor: 'rgba(139,124,246,0.15)' }]} onPress={() => setScreen('join')}>
            <Text style={[s0.ghostBtnText, { color: darkMode ? '#cccccc' : '#8B7CF6' }]}>Tengo un código de invitación</Text>
          </TouchableOpacity>
        </View>
      </View>
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
      <View style={[s1.wrap, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Nuevo plan" onBack={() => { setPlanName(''); setFromDate(null); setToDate(null); setScreen('inicio'); }} />
        <ScrollView style={s1.body} contentContainerStyle={s1.bodyContent} bounces={false}>
          <Text style={[s1.sectionLabel, { marginTop: 0, color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Nuevo plan</Text>
          <Text style={[s1.heading, { color: darkMode ? DARK.text : '#111827' }]}>¿Cuál es el plan? 🎉</Text>
          <Text style={[s1.sectionLabel, { marginTop: 0, color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Nombre del plan</Text>
          <TextInput
            style={[s1.inputActive, darkMode && { backgroundColor: DARK.elevated, borderColor: DARK.border, color: DARK.text }]}
            value={planName}
            onChangeText={setPlanName}
            autoCapitalize="characters"
            autoCorrect={true}
            spellCheck={true}
            placeholder="Ej: CENA DE CUMPLEAÑOS 🎂"
            placeholderTextColor={darkMode ? DARK.textMuted : '#9CA3AF'}
          />
          <View style={{ borderBottomWidth: 2, borderBottomColor: darkMode ? DARK.border : '#D1D5DB', marginVertical: 12 }} />
          <Text style={[s1.sectionLabel, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>¿Cuándo podría ser?</Text>
          <View style={s1.dateRow}>
            <TouchableOpacity style={[s1.dateBox, darkMode && { backgroundColor: DARK.elevated, borderColor: DARK.border }]} onPress={() => {
              const d = new Date();
              pickedDateRef.current = d;
              setTempDate(d); setShowDatePicker('from');
            }}>
              <Text style={[s1.dateLbl, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Desde</Text>
              <Text style={[s1.dateVal, { color: darkMode ? DARK.text : '#111827' }]}>{showDatePicker === 'from' ? formatDate(tempDate) : (fromDate ? formatDate(fromDate) : 'Elegir fecha')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s1.dateBox, darkMode && { backgroundColor: DARK.elevated, borderColor: DARK.border }]} onPress={() => {
              const d = new Date();
              pickedDateRef.current = d;
              setTempDate(d); setShowDatePicker('to');
            }}>
              <Text style={[s1.dateLbl, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Hasta</Text>
              <Text style={[s1.dateVal, { color: darkMode ? DARK.text : '#111827' }]}>{showDatePicker === 'to' ? formatDate(tempDate) : (toDate ? formatDate(toDate) : 'Elegir fecha')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ borderBottomWidth: 2, borderBottomColor: darkMode ? DARK.border : '#D1D5DB', marginVertical: 12 }} />
          <Text style={[s1.sectionLabel, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>¿A qué hora podría ser?</Text>
          <View style={s1.durRow}>
            {TIME_PERIODS.map((p, i) => (
              <TouchableOpacity
                key={p.label}
                style={[s1.durOpt, darkMode && { backgroundColor: DARK.elevated }, periodIdx === i && s1.durOptSel]}
                onPress={() => {
                  setPeriodIdx(i);
                  setCustomStartHour(p.startHour);
                  setCustomEndHour(p.endHour);
                }}
              >
                <Text style={[s1.durOptText, darkMode && { color: DARK.textSecondary }, periodIdx === i && s1.durOptTextSel, darkMode && periodIdx === i && { color: '#cccccc' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {periodIdx >= 0 && <View style={[s1.hourPickerRow, darkMode && { borderTopColor: DARK.border }]}>
            <View style={s1.hourPickerCol}>
              <Text style={[s1.hourPickerLabel, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Desde</Text>
              <View style={[s1.hourPickerFrame, darkMode && { backgroundColor: DARK.elevated }]}>
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
                        i === desdeCenterRef.current && s1.hourPickerTextSel,
                        darkMode && { color: i === desdeCenterRef.current ? '#fff' : DARK.textSecondary }
                      ]}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={s1.hourPickerCol}>
              <Text style={[s1.hourPickerLabel, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Hasta</Text>
              <View style={[s1.hourPickerFrame, darkMode && { backgroundColor: DARK.elevated }]}>
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
                        i === hastaCenterRef.current && s1.hourPickerTextSel,
                        darkMode && { color: i === hastaCenterRef.current ? '#fff' : DARK.textSecondary }
                      ]}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : i < 24 ? `${i - 12}:00 PM` : '12:00 AM'}</Text>
                    </View>
                  ))}
                </ScrollView>
            </View>
          </View>
          </View>}
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
              themeVariant={darkMode ? 'dark' : 'light'}
              textColor={darkMode ? '#fff' : undefined}
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
            if (periodIdx < 0) {
              Alert.alert('Franja horaria', 'Selecciona una franja horaria');
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
      <View style={[s2.wrap, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Invitar" onBack={() => setScreen('crear')} />
        <ScrollView style={s2.body} contentContainerStyle={s2.bodyContent} bounces={false}>
          <Text style={[s2.heading, { color: darkMode ? DARK.text : '#111827' }]}>Integrantes 👥</Text>
          <Text style={{ fontSize: 14, color: darkMode ? DARK.textSecondary : '#6B7280', marginBottom: 16 }}>Comparte este código para que se unan al plan</Text>
          <View style={[s2.linkCard, darkMode && { backgroundColor: DARK.card, borderColor: DARK.border }]}>
            <Text style={[s2.linkCardLabel, { color: darkMode ? DARK.text : '#8B7CF6' }]}>Código y enlace de invitación</Text>
            <View style={s2.linkRow}>
              <Text style={[s2.linkText, { color: darkMode ? DARK.textSecondary : '#6B7280' }]} numberOfLines={1}>{roomCode}</Text>
            </View>
            <View style={s2.linkRow}>
                <Text style={[s2.linkText, { color: darkMode ? DARK.textSecondary : '#6B7280' }]} numberOfLines={1}>http://miapp.com/unirse/{roomCode}</Text>
              <TouchableOpacity
                style={s2.copyBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(roomCode);
                  Alert.alert('Copiado', 'Código copiado');
                }}
              >
                <Text style={s2.copyBtnText}>Copiar</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: darkMode ? DARK.text : '#374151', marginBottom: 12, marginTop: 8 }}>Comparte el código con tus amigos:</Text>
          <View style={s2.shareRow}>
            {[
              { icon: '💬', label: 'WhatsApp', isWa: true },
              { icon: '📱', label: 'Mensaje' },
              { icon: '📧', label: 'Email', isEmail: true },
            ].map((s) => (
              <TouchableOpacity key={s.label} style={[s2.shareBtn, darkMode && { backgroundColor: DARK.card, borderColor: DARK.border }]} onPress={async () => {
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
                <Text style={[s2.shareLabel, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s2.peopleTitle, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Personas unidas · {participants.length}/{groupSize}</Text>
          {participants.map((p, i) => {
            const custom = customColors[p.name];
            const ac = custom || (i === 0 ? { color: '#8B7CF6', bg: '#EEF2FF' } : AVATAR_COLORS[(i - 1) % AVATAR_COLORS.length]);
            return (
              <View key={p.name} style={[s2.personRow, darkMode && { borderBottomColor: DARK.border }]}>
                <TouchableOpacity onPress={() => setEditingColorIdx(i)} style={[s2.avatar, { backgroundColor: ac.bg }]}>
                  <Text style={[s2.avatarText, { color: ac.color }]}>{p.initial}</Text>
                </TouchableOpacity>
                <Text style={[s2.personName, { color: darkMode ? DARK.text : '#111827' }]}>{p.name}</Text>
                <Text style={[s2.personStatus, { color: p.status === 'conectado' ? '#10B981' : '#9CA3AF' }]}>
                  {STATUS_TEXT[p.status]}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={[s2.bottom, { paddingTop: 0 }]}>
          <TouchableOpacity style={s2.nextBtn} onPress={async () => {
            const { status } = await Calendar.requestCalendarPermissionsAsync();
            if (status === 'granted') {
              await fetchDeviceCalendarEvents();
              calendarConnected.current = true;
              setCompletedSteps(prev => [...prev, 'invitar']);
              pendingAlert.current = true;
              setScreen('heatmap');
            }
          }}>
            <Text style={s2.nextBtnText}>📆 Conectar calendario</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s3.manualBtn, { marginTop: 6 }, darkMode && { backgroundColor: 'rgba(255,255,255,0.05)' }]} onPress={() => setScreen('blockout')}>
            <Text style={[s3.manualBtnText, darkMode && { color: DARK.text }]}>Poner mis horarios manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'join') {
    content = (
      <View style={[s2.wrap, { justifyContent: 'center', paddingBottom: 40 }, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Unirse" onBack={() => setScreen('inicio')} />
        </View>
        <View style={{ padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', color: darkMode ? DARK.text : '#11181C' }}>Unirse a un Plan</Text>
          <Text style={{ fontSize: 16, color: darkMode ? DARK.textSecondary : '#687076', textAlign: 'center' }}>Ingresa tu nombre y el código que te compartieron</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: darkMode ? DARK.textSecondary : '#6B7280', marginTop: 8, letterSpacing: 0.6 }}>Nombre</Text>
          <TextInput
            style={{
              width: '100%', borderWidth: 1, borderColor: darkMode ? DARK.border : '#dee2e6', borderRadius: 12,
              padding: 16, fontSize: 18, color: darkMode ? DARK.text : '#11181C', textAlign: 'center',
              backgroundColor: darkMode ? DARK.elevated : 'transparent',
            }}
            placeholder="Tu nombre"
            placeholderTextColor={darkMode ? DARK.textMuted : '#9CA3AF'}
            value={joinName}
            onChangeText={setJoinName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 13, fontWeight: '700', color: darkMode ? DARK.textSecondary : '#6B7280', letterSpacing: 0.6 }}>Código del plan</Text>
          <TextInput
            style={{
              width: '100%', borderWidth: 1, borderColor: darkMode ? DARK.border : '#dee2e6', borderRadius: 12,
              padding: 16, fontSize: 20, color: darkMode ? DARK.text : '#11181C', textAlign: 'center', letterSpacing: 4,
              backgroundColor: darkMode ? DARK.elevated : 'transparent',
            }}
            placeholder="Ej: A1B2C3"
            placeholderTextColor={darkMode ? DARK.textMuted : '#9CA3AF'}
            value={joinInput}
            onChangeText={setJoinInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={{ width: '100%', backgroundColor: '#8B7CF6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 }}
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
                setPeriodIdx(match.periodIdx >= 0 ? match.periodIdx : 3);
                const pi = match.periodIdx >= 0 ? match.periodIdx : 3;
                setCustomStartHour(match.customStartHour ?? TIME_PERIODS[pi].startHour);
                setCustomEndHour(match.customEndHour ?? TIME_PERIODS[pi].endHour);
                setGroupSize(match.groupSize);
                setRoomCode(code);
                joinRoom(code);
                const name = joinName.trim();
                const ac = getUnusedColor(code);
                addParticipant(code, {
                  name,
                  initial: name[0].toUpperCase(),
                  color: ac.color, bg: ac.bg, status: 'conectado',
                });
                setCompletedSteps(prev => [...new Set([...prev, 'crear'])]);
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
      <View style={[s7.wrap, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Mis horarios" onBack={() => setScreen('invitar')} />
        <View style={s7.header}>
          <Text style={[s7.title, { color: darkMode ? DARK.text : '#111827' }]}>Toca las horas que NO puedes ⛔</Text>
          <Text style={[s7.subtitle, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Marcá cuándo estás ocupada para el plan</Text>
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
          <TouchableOpacity style={s7.saveBtn} onPress={() => { calendarConnected.current = true; setCompletedSteps(prev => [...prev, 'invitar']); setScreen('heatmap'); }}>
            <Text style={s7.saveBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'heatmap') {
    const modifiedHeatmap = getModifiedHeatmap();
    const totalP = participants.length || 1;
    content = (
      <View style={[s4.wrap, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Disponibilidad" onBack={() => setScreen('invitar')} />
        <View style={s4.header}>
          <View>
            <Text style={[s4.heatTitle, { color: darkMode ? DARK.text : '#111827' }]}>Disponibilidad</Text>
            <Text style={[s4.heatSub, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>{formatDateRange()}</Text>
          </View>
          <View style={s4.avatarsRow}>
            {(participants.length ? participants : PEOPLE.slice(0, 4)).map((p, i) => {
              const ac = i === 0 ? { color: '#8B7CF6', bg: '#EEF2FF' } : AVATAR_COLORS[(i - 1) % AVATAR_COLORS.length];
              return (
                <View key={p.name} style={[s4.avaSm, {
                  backgroundColor: ac.bg,
                  marginLeft: i > 0 ? -6 : 0,
                }]}>
                  <Text style={[s4.avaSmText, { color: ac.color }]}>{p.initial}</Text>
                </View>
              );
            })}
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
                    const v = modifiedHeatmap[ri]?.[absCi] ?? 0;
                    const pct = totalP > 0 ? v / totalP : 0;
                    const ciCol = pct >= 0.75 ? '#10B981' : pct >= 0.5 ? '#D1FAE5' : pct >= 0.25 ? '#FEF3C7' : '#E5E7EB';
                    return (
                      <TouchableOpacity
                        key={vi}
                        style={[s4.heatCell, { backgroundColor: ciCol }]}
                        onPress={() => {
                          setModalDay(formatCellDay(absCi));
                          setModalTime(formatCellTime(ri));
                          setShowModal(true);
                        }}
                      >
                        <Text style={[s4.cellLabel, {
                          color: pct >= 0.75 ? '#065F46' : pct >= 0.5 ? '#92400E' : '#9CA3AF',
                        }]}>
                          {v}/{totalP}
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
            { color: '#10B981', label: `${totalP}/${totalP}` },
            ...(totalP >= 2 ? [{ color: '#D1FAE5', label: `${totalP - 1}/${totalP}` }] : []),
            ...(totalP >= 3 ? [{ color: '#FEF3C7', label: `${totalP - 2}/${totalP}` }] : []),
            { color: '#E5E7EB', label: `0/${totalP}` },
          ].map((l) => (
            <View key={l.label} style={s4.legendItem}>
              <View style={[s4.legendDot, { backgroundColor: l.color }]} />
              <Text style={s4.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={[s4.editBlockBtn, darkMode && { backgroundColor: DARK.card }]} onPress={() => setScreen('blockout')}>
          <Text style={[s4.editBlockBtnText, darkMode && { color: DARK.textSecondary }]}>
            Editar horarios ocupados ✏️
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
    const totalP = participants.length || 1;
    const filteredOptions = OPTIONS.filter(o => o.count === 4).map(o => ({ ...o, count: totalP }));
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
      <View style={[s5.wrap, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Mejores horarios" onBack={() => setScreen('heatmap')} />
        <ScrollView style={s5.body} contentContainerStyle={s5.bodyContent} bounces={false}>
          <Text style={[s5.title, { color: darkMode ? DARK.text : '#111827' }]}>Mejores opciones ✨</Text>
          <Text style={[s5.subtitle, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Todos disponibles</Text>
          {sortedGroups.map(([dayLabel, options]) => (
            <View key={dayLabel}>
              <View style={s5.sectionHeader}>
                <View style={s5.sectionLine} />
                <Text style={s5.sectionText}>{dayLabel}</Text>
                <View style={s5.sectionLine} />
              </View>
              {options.map((o, i) => {
                const selected = selectedOption?.day === o.day && selectedOption?.time === o.time;
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
                        <Text style={[s5.badgeText, darkMode && { color: '#cccccc' }]}>{o.count}/{totalP}</Text>
                      </View>
                    </View>
                    <View style={s5.cardBottom}>
                      <View style={s5.avatarsRow}>
                        {(participants.length ? participants : PEOPLE.slice(0, o.count)).map((p, j) => {
                          const pc = j === 0 ? { color: '#8B7CF6', bg: '#EEF2FF' } : AVATAR_COLORS[(j - 1) % AVATAR_COLORS.length];
                          return (
                            <View key={p.name} style={[s5.avaSm, {
                              backgroundColor: pc.bg,
                              marginLeft: j > 0 ? -6 : 0,
                            }]}>
                              <Text style={[s5.avaSmText, { color: pc.color }]}>{p.initial}</Text>
                            </View>
                          );
                        })}
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
                        <Text style={[s5.canText, { color: o.color }]}>{o.count}/{totalP} disponibles</Text>
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
      <View style={[s6.wrap, darkMode && { backgroundColor: DARK.bg }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
          <TopNav darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} title="Confirmado" onBack={() => setScreen('heatmap')} />
        <ScrollView style={s6.body} contentContainerStyle={s6.bodyContent} bounces={false}>
          <View style={s6.successIcon}>
            <Text style={{ fontSize: 34 }}>✅</Text>
          </View>
          <Text style={[s6.title, { color: darkMode ? DARK.text : '#111827' }]}>¡Plan confirmado!</Text>
          <Text style={[s6.subtitle, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Ya saben cuándo se van a ver</Text>
          <View style={[s6.confirmCard, darkMode && { backgroundColor: DARK.card, borderColor: DARK.border }]}>
            <Text style={[s6.cardLbl, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Plan</Text>
            <Text style={[s6.cardName, { color: darkMode ? DARK.text : '#111827' }]}>{planName}</Text>
            <View style={s6.dateRow}>
              <View style={[s6.dateIcon, darkMode && { backgroundColor: DARK.elevated }]}>
                <Text style={{ fontSize: 18 }}>📅</Text>
              </View>
              <View>
                <Text style={[s6.dateVal, { color: darkMode ? DARK.text : '#111827' }]}>{confirmedDay || selectedOption?.day || 'Miércoles 15 de enero'}</Text>
                <Text style={[s6.timeVal, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>{confirmedTime || selectedOption?.time || '7:00 PM – 9:00 PM · 2 horas'}</Text>
              </View>
            </View>
            <Text style={[s6.attendLbl, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Asistentes</Text>
            <View style={s6.attendRow}>
              {(participants.length ? participants : PEOPLE.slice(0, 4)).map((p, i) => {
                const ac = i === 0 ? { color: '#8B7CF6', bg: '#EEF2FF' } : AVATAR_COLORS[(i - 1) % AVATAR_COLORS.length];
                return (
                  <View key={p.name} style={s6.attendPerson}>
                    <View style={[s6.attendAva, { backgroundColor: ac.bg }]}>
                      <Text style={[s6.attendAvaText, { color: ac.color }]}>{p.initial}</Text>
                    </View>
                    <Text style={s6.attendName}>
                      {p.name === 'Tú' ? (useAuthStore.getState().user?.name || 'Tú') : p.name}
                    </Text>
                  </View>
                );
              })}
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
            const texto = `🎉 *${planName}*\n📅 ${dia}\n⏰ ${hora}\n\n👇 Únete con el código: ${roomCode}\n\n✨ Hecho con MiApp`;
            await Share.share({ message: texto });
          }}>
            <Text style={s6.shareBtnText}>Compartir con el grupo 💬</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const navBar = MAIN_SCREENS.has(screen) && (
    <View style={[navStyle.bar, darkMode && { backgroundColor: DARK.bg, borderTopColor: DARK.border }]}>
      {NAV_STEPS.map((step, i) => {
        const isCurrent = step.key === screen;
        const isDone = navCompleted[i];
    const prereq = [true, !!roomCode, !!calendarConnected.current, !!confirmedDay];
        const canGo = i === 0 || (i > 0 && prereq.slice(1, i + 1).every(Boolean)) || isCurrent;
        return (
          <TouchableOpacity
            key={step.key}
            style={[navStyle.item, !canGo && { opacity: 0.35 }]}
            activeOpacity={canGo ? 0.6 : 1}
            onPress={() => { if (canGo) navigateToStep(step.key); }}
          >
            <View style={[navStyle.dot, darkMode && { backgroundColor: DARK.elevated }, isCurrent && navStyle.dotCurrent, isCurrent && darkMode && { backgroundColor: '#8B7CF6' }, isDone && !isCurrent && navStyle.dotDone, isDone && !isCurrent && darkMode && { backgroundColor: '#3D5A4E' }]}>
              <Text style={navStyle.dotIcon}>{step.icon}</Text>
              {isDone && (
                <View style={navStyle.checkBadge}>
                  <Text style={[navStyle.checkText, darkMode && { color: '#cccccc' }]}>✓</Text>
                </View>
              )}
            </View>
            <Text style={[navStyle.label, isCurrent && navStyle.labelCurrent, isCurrent && darkMode && { color: DARK.text }, !canGo && navStyle.labelMuted, !canGo && darkMode && { color: DARK.textMuted }]}>
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
          <View style={[modalStyle.card, darkMode && { backgroundColor: DARK.card }]}>
            <Text style={[modalStyle.title, { color: darkMode ? DARK.text : '#111827' }]}>¿Confirmar fecha?</Text>
            <Text style={[modalStyle.subtitle, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>¿Quieres seleccionar esta fecha?</Text>
            <View style={[modalStyle.dateContainer, darkMode && { backgroundColor: DARK.elevated, borderColor: DARK.border }]}>
              <Text style={[modalStyle.dateDay, { color: darkMode ? DARK.text : '#111827' }]}>{modalDay}</Text>
              <Text style={[modalStyle.dateTime, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>{modalTime}</Text>
            </View>
            <View style={modalStyle.btnRow}>
              <TouchableOpacity
                style={[modalStyle.cancelBtn, darkMode && { backgroundColor: DARK.elevated }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[modalStyle.cancelBtnText, { color: darkMode ? DARK.textSecondary : '#6B7280' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modalStyle.confirmBtn}
                onPress={() => {
                  setConfirmedDay(modalDay);
                  setConfirmedTime(modalTime);
                  setShowModal(false);
                  setCompletedSteps(prev => [...prev, 'heatmap', 'confirmado']);
                  setScreen('confirmado');
                }}
              >
                <Text style={modalStyle.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={editingColorIdx !== null}
        transparent
        animationType="none"
        onRequestClose={() => setEditingColorIdx(null)}
      >
        <View style={modalStyle.overlay}>
          <View style={[modalStyle.card, darkMode && { backgroundColor: DARK.card }]}>
            <Text style={[modalStyle.title, { color: darkMode ? DARK.text : '#111827' }]}>Elegir color</Text>
            {(() => {
              const usedColors = new Set<string>();
              participants.forEach((p, i) => {
                if (i === editingColorIdx) return;
                const custom = customColors[p.name];
                const ac = custom || (i === 0 ? { color: '#8B7CF6', bg: '#EEF2FF' } : AVATAR_COLORS[(i - 1) % AVATAR_COLORS.length]);
                usedColors.add(ac.color);
              });
              const ALL_COLORS = [{ color: '#8B7CF6', bg: '#EEF2FF' }, ...AVATAR_COLORS];
              return (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginVertical: 20 }}>
                  {ALL_COLORS.filter(c => !usedColors.has(c.color)).map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      style={{
                        width: 40, height: 40, borderRadius: 20, backgroundColor: c.bg,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                      onPress={() => {
                        if (editingColorIdx !== null) {
                          const p = participants[editingColorIdx];
                          if (p) {
                            setCustomColors(prev => ({ ...prev, [p.name]: c }));
                          }
                          setEditingColorIdx(null);
                        }
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: c.color }}>
                        {editingColorIdx !== null ? participants[editingColorIdx]?.initial : '?'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}
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
    color: '#8B7CF6',
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
    width: 68,
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
    color: '#8B7CF6',
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
    fontWeight: '600',
    color: '#cccccc',
    letterSpacing: 0.5,
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
    color: '#8B7CF6',
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
    fontWeight: '600',
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
    padding: 16,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginTop: 8,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  inputActive: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    height: 50,
    fontFamily: 'Arial',
    letterSpacing: 0,
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
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
    gap: 12,
    marginBottom: 12,
  },
  durOpt: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  durOptSel: {
    backgroundColor: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
    marginTop: 8,
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
    borderColor: 'rgba(139,124,246,0.15)',
    borderRadius: 18,
    padding: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  linkCardLabel: {
    fontSize: 13,
    color: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
    backgroundColor: 'rgba(139,124,246,0.06)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    letterSpacing: 0.3,
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
    color: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
      color: '#059669',
      fontSize: 16,
    fontWeight: '600',
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
    color: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
    backgroundColor: '#8B7CF6',
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
