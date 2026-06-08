import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, Modal, Share, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { calendarApi } from '@/lib/api/calendar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { handleGoogleSignIn } from '@/lib/api/auth';
import * as Calendar from 'expo-calendar';

const PEOPLE = [
  { initial: 'T', name: 'Tú', color: '#5B4FDB', bg: '#EEF2FF' },
  { initial: 'M', name: 'María', color: '#10B981', bg: '#D1FAE5' },
  { initial: 'C', name: 'Carlos', color: '#F59E0B', bg: '#FEF3C7' },
  { initial: 'S', name: 'Sofía', color: '#DB2777', bg: '#FCE7F3' },
  { initial: 'D', name: 'Diego', color: '#9CA3AF', bg: '#F3F4F6' },
];

const DAYS = ['L', 'M', 'M', 'J', 'V'];
const HOURS = ['6h','7h','8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h','21h','22h','23h','0h','1h','2h','3h','4h','5h'];
const DISPLAY_HOURS = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm','12am','1am','2am','3am','4am','5am'];

const HEATMAP = Array.from({ length: 24 }, () => Array(5).fill(4));

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

function TopNav({ title, onBack }: { title: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[navStyle.wrap, { paddingTop: insets.top + 8 }]}>
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
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [selectedOption, setSelectedOption] = useState<typeof OPTIONS[0] | null>(null);
  const [confirmedDay, setConfirmedDay] = useState('');
  const [confirmedTime, setConfirmedTime] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalDay, setModalDay] = useState('');
  const [modalTime, setModalTime] = useState('');

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (screen === 'heatmap' && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchDeviceCalendarEvents();
    }
    if (screen !== 'heatmap') {
      fetchedRef.current = false;
    }
  }, [screen]);

  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  const [userGrid, setUserGrid] = useState<boolean[][]>(
    () => HOURS.map(() => DAYS.map(() => false))
  );
  const [googleBusyGrid, setGoogleBusyGrid] = useState<boolean[][]>(
    () => HOURS.map(() => DAYS.map(() => false))
  );

  function toggleUserCell(hourIdx: number, dayIdx: number) {
    setUserGrid(prev => {
      const next = prev.map(r => [...r]);
      next[hourIdx][dayIdx] = !next[hourIdx][dayIdx];
      return next;
    });
  }

  function isSlotBlocked(dayIdx: number, hourIdx: number): boolean {
    return userGrid[hourIdx]?.[dayIdx] ?? false;
  }

  function getModifiedHeatmap(): number[][] {
    return HEATMAP.map((row, ri) =>
      row.map((v, ci) => {
        let val = v;
        if (isSlotBlocked(ci, ri)) val = Math.max(0, val - 1);
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

      const weekStart = new Date(fromDate ?? new Date());
      const d = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - d);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 5);
      weekEnd.setHours(0, 0, 0, 0);

      const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const matching = events.filter(ev => {
        if (ev.allDay) return false;
        const s = new Date(ev.startDate);
        return s >= weekStart && s < weekEnd && s.getDay() !== 0 && s.getDay() !== 6;
      });
      const matchInfo = matching.slice(0, 5).map(ev => {
        const s = new Date(ev.startDate);
        return `${ev.title} ${s.getDate()} ${months[s.getMonth()]} ${s.getHours()}:${String(s.getMinutes()).padStart(2,'0')}`;
      }).join('\n');
      Alert.alert(`📊 Eventos en la semana: ${matching.length}`, matchInfo || 'Ninguno');

      const busy = HOURS.map(() => DAYS.map(() => false));

      for (const ev of matching) {
        const s = new Date(ev.startDate);
        const e = new Date(ev.endDate);
        const dayIdx = s.getDay();
        const col = dayIdx - 1;
        const startH = s.getHours() + s.getMinutes() / 60;
        const endH = e.getHours() + e.getMinutes() / 60;
        for (let ri = 0; ri < HOURS.length; ri++) {
          const slotStart = parseInt(HOURS[ri]);
          const slotEnd = slotStart + 1;
          if (startH < slotEnd && endH > slotStart) {
            busy[ri][col] = true;
          }
        }
      }
      setGoogleBusyGrid(busy);
    } catch (err) {
      console.warn('Failed to read calendar events:', err);
    }
  }

  const durOptions = ['1h', '2h', '3h', 'Todo el día'];

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

  function formatCellDay(dayIdx: number): string {
    const date = new Date(fromDate ?? new Date());
    const dayOfWeek = date.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    date.setDate(date.getDate() - diffToMonday + dayIdx);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  function formatDateRange(): string {
    if (!fromDate || !toDate) return '';
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fd = `${days[fromDate.getDay()]} ${fromDate.getDate()} ${months[fromDate.getMonth()]}`;
    const td = `${days[toDate.getDay()]} ${toDate.getDate()} ${months[toDate.getMonth()]}`;
    return `${fd} - ${td}`;
  }

  function formatCellTime(hourIdx: number): string {
    const start = parseInt(HOURS[hourIdx]);
    const dur = parseInt(durOptions[durationIdx]) || 2;
    const end = (start + dur) % 24;
    const fmt = (h: number) => {
      const a = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${h12}:00 ${a}`;
    };
    return `${fmt(start)} – ${fmt(end)} · ${durOptions[durationIdx]}`;
  }

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
          <TouchableOpacity style={s0.primaryBtn} onPress={() => { setPlanName(''); setFromDate(null); setToDate(null); setScreen('crear'); }}>
            <Text style={s0.primaryBtnText}>Crear un plan ✨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s0.ghostBtn} onPress={() => router.push('/join')}>
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
        <ScrollView style={s1.body} contentContainerStyle={s1.bodyContent}>
          <Text style={s1.sectionLabel}>Nuevo plan</Text>
          <Text style={s1.heading}>¿Cuál es el plan? 🎉</Text>
          <Text style={s1.sectionLabel}>Nombre del plan</Text>
          <TextInput
            style={s1.inputActive}
            value={planName}
            onChangeText={(t) => setPlanName(t.toUpperCase())}
            placeholder="Ej: CENA DE CUMPLEAÑOS 🎂"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={s1.sectionLabel}>¿Cuándo podría ser?</Text>
          <View style={s1.dateRow}>
            <TouchableOpacity style={s1.dateBox} onPress={() => {
              setTempDate(new Date()); setShowDatePicker('from');
            }}>
              <Text style={s1.dateLbl}>Desde</Text>
              <Text style={s1.dateVal}>{showDatePicker === 'from' ? formatDate(tempDate) : (fromDate ? formatDate(fromDate) : 'Elegir fecha')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s1.dateBox} onPress={() => {
              setTempDate(new Date()); setShowDatePicker('to');
            }}>
              <Text style={s1.dateLbl}>Hasta</Text>
              <Text style={s1.dateVal}>{showDatePicker === 'to' ? formatDate(tempDate) : (toDate ? formatDate(toDate) : 'Elegir fecha')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s1.sectionLabel}>Duración</Text>
          <View style={s1.durRow}>
            {durOptions.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[s1.durOpt, durationIdx === i && s1.durOptSel]}
                onPress={() => setDurationIdx(i)}
              >
                <Text style={[s1.durOptText, durationIdx === i && s1.durOptTextSel]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
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
              if (showDatePicker === 'from') setFromDate(tempDate);
              if (showDatePicker === 'to') setToDate(tempDate);
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
            setScreen('invitar');
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
        <ScrollView style={s2.body} contentContainerStyle={s2.bodyContent}>
          <Text style={s2.heading}>Invita a tu grupo 👥</Text>
          <View style={s2.linkCard}>
            <Text style={s2.linkCardLabel}>Código y enlace de invitación</Text>
            <View style={s2.linkRow}>
              <Text style={s2.linkText} numberOfLines={1}>PLAN-A1B2</Text>
            </View>
            <View style={s2.linkRow}>
              <Text style={s2.linkText} numberOfLines={1}>http://cuando.app/plan/abc123</Text>
              <TouchableOpacity
                style={s2.copyBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync('🔑 Código del plan: *PLAN-A1B2*\n\nhttp://cuando.app/plan/abc123');
                  Alert.alert('Copiado', 'Código y enlace copiados');
                }}
              >
                <Text style={s2.copyBtnText}>Copiar</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s2.shareRow}>
            {[
              { icon: '💬', label: 'WhatsApp', isWa: true },
              { icon: '📱', label: 'Mensaje' },
              { icon: '📧', label: 'Email', isEmail: true },
            ].map((s) => (
              <TouchableOpacity key={s.label} style={s2.shareBtn} onPress={async () => {
                const codigo = 'PLAN-A1B2';
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
          <Text style={s2.peopleTitle}>Personas unidas · 2/5</Text>
          {PEOPLE.slice(0, -1).map((p, i) => (
            <View key={p.name} style={s2.personRow}>
              <View style={[s2.avatar, { backgroundColor: p.bg }]}>
                <Text style={[s2.avatarText, { color: p.color }]}>{p.initial}</Text>
              </View>
              <Text style={s2.personName}>{p.name}</Text>
              <Text style={[s2.personStatus, {
                color: i < 2 ? '#10B981' : i < 4 ? '#F59E0B' : '#9CA3AF',
              }]}>
                {i < 2 ? STATUS_TEXT.conectado : i < 4 ? STATUS_TEXT.esperando : STATUS_TEXT.invitado}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={s2.bottom}>
          <TouchableOpacity style={s2.nextBtn} onPress={() => setScreen('conectar')}>
            <Text style={s2.nextBtnText}>Ya están todos →</Text>
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
              { icon: '🔒', text: 'Solo lectura — sin cambios' },
              { icon: '👁️', text: 'El grupo solo ve libre / ocupado' },
              { icon: '🗑️', text: 'Desconecta cuando quieras' },
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
            const user = await handleGoogleSignIn();
            if (user) {
              Alert.alert('✅ Conectado', `Calendario de ${user.email} conectado`);
              setScreen('heatmap');
            }
          }}>
            <Text style={s3.googleG}>G</Text>
            <Text style={s3.googleText}> Conectar con Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s3.manualBtn} onPress={() => setScreen('blockout')}>
            <Text style={s3.manualBtnText}>Poner mis horarios manualmente</Text>
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
          <View style={s7.gridHeader}>
            <View style={{ width: 38 }} />
            {DAYS.map((d, i) => (
              <View key={i} style={s7.dayCell}>
                <Text style={s7.dayLabel}>{d}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 18 }}>
          <View style={s7.heatGrid}>
            {HOURS.map((hr, ri) => (
              <View key={ri} style={s7.heatRow}>
                <View style={s7.hourCell}>
                  <Text style={s7.hourLabel}>{DISPLAY_HOURS[ri]}</Text>
                </View>
                {DAYS.map((_, ci) => {
                  const blocked = userGrid[ri]?.[ci] ?? false;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[s7.heatCell, {
                        backgroundColor: blocked ? '#DC2626' : '#F9FAFB',
                        borderColor: blocked ? '#DC2626' : '#E5E7EB',
                      }]}
                      onPress={() => toggleUserCell(ri, ci)}
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
            {PEOPLE.slice(0, 4).map((p, i) => (
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
          <View style={s4.gridScoreRow}>
            <View style={{ width: 38 }} />
            {DAYS.map((_, ci) => {
              const d = ((fromDate ?? new Date()).getDay() + 6) % 7;
              const date = new Date(fromDate ?? new Date());
              date.setDate(date.getDate() - d + ci);
              const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
              return (
                <View key={ci} style={s4.dayCell}>
                  <Text style={s4.scoreText}>
                    {date.getDate()} {months[date.getMonth()]}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={s4.gridHeader}>
            <View style={{ width: 38 }} />
            {DAYS.map((d, i) => (
              <View key={i} style={s4.dayCell}>
                <Text style={s4.dayLabel}>{d}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={s4.heatGridScroll}>
            <View style={s4.heatGrid}>
              {modifiedHeatmap.map((row, ri) => (
                <View key={ri} style={s4.heatRow}>
                  <View style={s4.hourCell}>
                    <Text style={s4.hourLabel}>{DISPLAY_HOURS[ri]}</Text>
                  </View>
                  {row.map((v, ci) => {
                    return (
                      <TouchableOpacity
                        key={ci}
                        style={[s4.heatCell, {
                          backgroundColor: CELL_COLORS[v],
                        }]}
                        onPress={() => {
                          setModalDay(formatCellDay(ci));
                          setModalTime(formatCellTime(ri));
                          setShowModal(true);
                        }}
                      >
                        <Text style={[s4.cellLabel, {
                          color: v >= 3 ? '#065F46' : v === 2 ? '#92400E' : '#9CA3AF',
                        }]}>
                          {CELL_LABELS[v]}
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
        <ScrollView style={s5.body} contentContainerStyle={s5.bodyContent}>
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
        <ScrollView style={s6.body} contentContainerStyle={s6.bodyContent}>
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
              {PEOPLE.slice(0, 4).map((p) => (
                <View key={p.name} style={s6.attendPerson}>
                  <View style={[s6.attendAva, { backgroundColor: p.bg }]}>
                    <Text style={[s6.attendAvaText, { color: p.color }]}>{p.initial}</Text>
                  </View>
                  <Text style={s6.attendName}>
                    {p.name === 'Tú' ? 'Ana' : p.name}
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

  return (
    <>
      {content}
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
                  setScreen('confirmado');
                }}
              >
                <Text style={modalStyle.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    padding: 16,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
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
    gap: 8,
  },
  durOpt: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  durOptSel: {
    backgroundColor: '#5B4FDB',
    borderColor: '#5B4FDB',
  },
  durOptText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  durOptTextSel: {
    color: '#fff',
    fontWeight: '700',
  },
  bottom: {
    padding: 24,
    paddingBottom: 36,
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
    paddingBottom: 36,
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
    fontSize: 20,
    width: 26,
  },
  privacyText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  bottomBtns: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 36,
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
    paddingHorizontal: 18,
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
    gap: 4,
    paddingBottom: 12,
  },
  heatRow: {
    flexDirection: 'row',
    gap: 4,
    height: 32,
  },
  hourCell: {
    width: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  hourLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  heatCell: {
    flex: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '700',
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
    backgroundColor: '#fff',
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
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDay: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  cardTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
  chooseBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
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
    paddingBottom: 36,
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
    paddingBottom: 16,
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
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 18,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  heatGrid: {
    gap: 4,
    paddingBottom: 8,
  },
  heatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
  },
  hourCell: {
    width: 38,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  hourLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  heatCell: {
    flex: 1,
    height: 26,
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
  legend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
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
    paddingBottom: 36,
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
