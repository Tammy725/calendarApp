import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

const PEOPLE = [
  { initial: 'T', name: 'Tú', color: '#5B4FDB', bg: '#EEF2FF' },
  { initial: 'M', name: 'María', color: '#10B981', bg: '#D1FAE5' },
  { initial: 'C', name: 'Carlos', color: '#F59E0B', bg: '#FEF3C7' },
  { initial: 'S', name: 'Sofía', color: '#DB2777', bg: '#FCE7F3' },
  { initial: 'D', name: 'Diego', color: '#9CA3AF', bg: '#F3F4F6' },
];

const DAYS = ['L', 'M', 'X', 'J', 'V'];
const HOURS = ['9h', '10h', '11h', '12h', '13h', '14h', '15h', '16h'];

const HEATMAP = [
  [2, 1, 0, 0, 1],
  [2, 0, 0, 1, 1],
  [1, 0, 0, 0, 2],
  [0, 0, 1, 1, 2],
  [0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0],
  [2, 0, 0, 1, 0],
  [2, 1, 0, 0, 0],
];

const CELL_COLORS: Record<number, string> = {
  0: '#10B981',
  1: '#F59E0B',
  2: '#F3F4F6',
};

const OPTIONS = [
  { day: 'Miércoles 15 ene', time: '7:00 – 9:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5', first: true },
  { day: 'Viernes 17 ene', time: '6:00 – 8:00 PM · 2h', count: 3, color: '#F59E0B', bg: '#FEF3C7' },
  { day: 'Jueves 16 ene', time: '8:00 – 10:00 PM · 2h', count: 3, color: '#F59E0B', bg: '#FEF3C7' },
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
  const [planName, setPlanName] = useState('Cena de cumpleaños 🎂');
  const [fromDate, setFromDate] = useState(new Date(2026, 0, 13));
  const [toDate, setToDate] = useState(new Date(2026, 0, 19));
  const [durationIdx, setDurationIdx] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);

  if (screen === 'inicio') {
    return (
      <View style={s0.wrap}>
        <StatusBar style="light" />
        <View style={s0.center}>
          <View style={s0.logo}>
            <Text style={s0.logoText}>📅</Text>
          </View>
          <Text style={s0.title}>Cuándo</Text>
          <Text style={s0.subtitle}>
            Encuentra el momento perfecto{'\n'}para quedar con tu gente
          </Text>
        </View>
        <View style={s0.buttons}>
          <TouchableOpacity style={s0.primaryBtn} onPress={() => setScreen('crear')}>
            <Text style={s0.primaryBtnText}>Crear un plan ✨</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s0.ghostBtn}>
            <Text style={s0.ghostBtnText}>Tengo un código de invitación</Text>
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
      if (showDatePicker === 'from' && selected) setFromDate(selected);
      if (showDatePicker === 'to' && selected) setToDate(selected);
      if (Platform.OS === 'android') setShowDatePicker(null);
    };

    const durOptions = ['1h', '2h', '3h', 'Todo el día'];

    return (
      <View style={s1.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Nuevo plan" onBack={() => setScreen('inicio')} />
        <ScrollView style={s1.body} contentContainerStyle={s1.bodyContent}>
          <Text style={s1.sectionLabel}>Nuevo plan</Text>
          <Text style={s1.heading}>¿Cuál es el plan? 🎉</Text>
          <Text style={s1.sectionLabel}>Nombre del plan</Text>
          <TextInput
            style={s1.inputActive}
            value={planName}
            onChangeText={setPlanName}
            placeholder="Ej: Cena de cumpleaños"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={s1.sectionLabel}>¿Cuándo podría ser?</Text>
          <View style={s1.dateRow}>
            <TouchableOpacity style={s1.dateBox} onPress={() => setShowDatePicker('from')}>
              <Text style={s1.dateLbl}>Desde</Text>
              <Text style={s1.dateVal}>{formatDate(fromDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s1.dateBox} onPress={() => setShowDatePicker('to')}>
              <Text style={s1.dateLbl}>Hasta</Text>
              <Text style={s1.dateVal}>{formatDate(toDate)}</Text>
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
          <DateTimePicker
            value={showDatePicker === 'from' ? fromDate : toDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onDateChange}
          />
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <TouchableOpacity
            style={s1.pickerDone}
            onPress={() => setShowDatePicker(null)}
          >
            <Text style={s1.pickerDoneText}>Listo</Text>
          </TouchableOpacity>
        )}
        <View style={s1.bottom}>
          <TouchableOpacity style={s1.nextBtn} onPress={() => setScreen('invitar')}>
            <Text style={s1.nextBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'invitar') {
    return (
      <View style={s2.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Invitar" onBack={() => setScreen('crear')} />
        <ScrollView style={s2.body} contentContainerStyle={s2.bodyContent}>
          <Text style={s2.heading}>Invita a tu grupo 👥</Text>
          <View style={s2.linkCard}>
            <Text style={s2.linkCardLabel}>Enlace de invitación</Text>
            <View style={s2.linkRow}>
              <Text style={s2.linkText} numberOfLines={1}>cuando.app/plan/abc123</Text>
              <View style={s2.copyBtn}>
                <Text style={s2.copyBtnText}>Copiar</Text>
              </View>
            </View>
          </View>
          <View style={s2.shareRow}>
            {[
              { icon: '💬', label: 'WhatsApp' },
              { icon: '📱', label: 'Mensaje' },
              { icon: '📧', label: 'Email' },
            ].map((s) => (
              <View key={s.label} style={s2.shareBtn}>
                <Text style={s2.shareIcon}>{s.icon}</Text>
                <Text style={s2.shareLabel}>{s.label}</Text>
              </View>
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
    return (
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
              Nunca modificaremos tu calendario.
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
          <TouchableOpacity style={s3.googleBtn} onPress={() => setScreen('heatmap')}>
            <Text style={s3.googleG}>G</Text>
            <Text style={s3.googleText}> Conectar con Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s3.manualBtn}>
            <Text style={s3.manualBtnText}>Poner mis horarios manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'heatmap') {
    return (
      <View style={s4.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Disponibilidad" onBack={() => setScreen('conectar')} />
        <View style={s4.header}>
          <View>
            <Text style={s4.heatTitle}>Disponibilidad</Text>
            <Text style={s4.heatSub}>4 personas · 13–19 enero</Text>
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
          <View style={s4.gridHeader}>
            <View style={{ width: 22 }} />
            {DAYS.map((d) => (
              <View key={d} style={s4.dayCell}>
                <Text style={s4.dayLabel}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={s4.heatGrid}>
            {HEATMAP.map((row, ri) => (
              <View key={ri} style={s4.heatRow}>
                <View style={s4.hourCell}>
                  <Text style={s4.hourLabel}>{HOURS[ri]}</Text>
                </View>
                {row.map((v, ci) => (
                  <View
                    key={ci}
                    style={[s4.heatCell, { backgroundColor: CELL_COLORS[v] }]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={s4.legend}>
          {[
            { color: '#10B981', label: 'Todos libres' },
            { color: '#F59E0B', label: 'Algunos' },
            { color: '#F3F4F6', label: 'Nadie' },
          ].map((l) => (
            <View key={l.label} style={s4.legendItem}>
              <View style={[s4.legendDot, { backgroundColor: l.color }]} />
              <Text style={s4.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s4.actionBtn} onPress={() => setScreen('mejores')}>
          <Text style={s4.actionBtnText}>Ver mejores horarios ✨</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'mejores') {
    return (
      <View style={s5.wrap}>
        <StatusBar style="dark" />
        <TopNav title="Mejores horarios" onBack={() => setScreen('heatmap')} />
        <ScrollView style={s5.body} contentContainerStyle={s5.bodyContent}>
          <Text style={s5.title}>Mejores opciones ✨</Text>
          <Text style={s5.subtitle}>Ordenadas por disponibilidad</Text>
          {OPTIONS.map((o, i) => (
            <View key={o.day} style={[s5.card, { backgroundColor: o.bg, borderColor: o.color + '30' }]}>
              <View style={s5.cardTop}>
                <View>
                  <Text style={s5.cardDay}>{o.day}</Text>
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
                {o.first ? (
                  <TouchableOpacity
                    style={[s5.chooseBtn, { backgroundColor: o.color }]}
                    onPress={() => setScreen('confirmado')}
                  >
                    <Text style={s5.chooseBtnText}>Elegir este ✓</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[s5.canText, { color: o.color }]}>{o.count}/4 pueden</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s6.wrap}>
      <StatusBar style="dark" />
        <TopNav title="Confirmado" onBack={() => setScreen('mejores')} />
      <ScrollView style={s6.body} contentContainerStyle={s6.bodyContent}>
        <View style={s6.successIcon}>
          <Text style={{ fontSize: 34 }}>✅</Text>
        </View>
        <Text style={s6.title}>¡Plan confirmado!</Text>
        <Text style={s6.subtitle}>Ya saben cuándo se van a ver</Text>
        <View style={s6.confirmCard}>
          <Text style={s6.cardLbl}>Plan</Text>
          <Text style={s6.cardName}>Cena de cumpleaños 🎂</Text>
          <View style={s6.dateRow}>
            <View style={s6.dateIcon}>
              <Text style={{ fontSize: 18 }}>📅</Text>
            </View>
            <View>
              <Text style={s6.dateVal}>Miércoles 15 de enero</Text>
              <Text style={s6.timeVal}>7:00 PM – 9:00 PM · 2 horas</Text>
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
        <TouchableOpacity style={s6.gcalBtn}>
          <Text style={s6.gcalBtnText}>Agregar a Google Calendar 📅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s6.shareBtn}>
          <Text style={s6.shareBtnText}>Compartir con el grupo 💬</Text>
        </TouchableOpacity>
      </View>
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
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    fontSize: 18,
    color: '#5B4FDB',
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
});

const s0 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#5B4FDB',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logoText: {
    fontSize: 38,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#5B4FDB',
    fontSize: 16,
    fontWeight: '700',
  },
  ghostBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ghostBtnText: {
    color: '#fff',
    fontSize: 15,
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
    padding: 20,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  heading: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  inputActive: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#5B4FDB',
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
    paddingHorizontal: 14,
  },
  dateLbl: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 3,
  },
  dateVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  durRow: {
    flexDirection: 'row',
    gap: 7,
  },
  durOpt: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  durOptSel: {
    backgroundColor: '#5B4FDB',
    borderColor: '#5B4FDB',
  },
  durOptText: {
    fontSize: 13,
    color: '#111827',
  },
  durOptTextSel: {
    color: '#fff',
    fontWeight: '600',
  },
  bottom: {
    padding: 20,
    paddingBottom: 32,
  },
  nextBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    padding: 20,
    flexGrow: 1,
  },
  heading: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  linkCard: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(91,79,219,0.15)',
    borderRadius: 16,
    padding: 13,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  linkCardLabel: {
    fontSize: 11,
    color: '#5B4FDB',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  copyBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  copyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  shareLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  peopleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  personName: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  personStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottom: {
    padding: 20,
    paddingBottom: 32,
  },
  nextBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const s3 = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bodyTop: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: 'center',
  },
  calIcon: {
    width: 94,
    height: 94,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 22,
  },
  privacyList: {
    width: '100%',
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  privacyIcon: {
    fontSize: 17,
    width: 22,
  },
  privacyText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  bottomBtns: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleG: {
    fontWeight: '700',
    fontSize: 16,
    color: '#4285F4',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  manualBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  manualBtnText: {
    fontSize: 13,
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  heatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  heatSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  avatarsRow: {
    flexDirection: 'row',
  },
  avaSm: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaSmText: {
    fontSize: 8,
    fontWeight: '700',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 14,
  },
  gridHeader: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  heatGrid: {
    flex: 1,
    gap: 3,
  },
  heatRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  hourCell: {
    width: 22,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 2,
  },
  hourLabel: {
    fontSize: 9,
    color: '#6B7280',
  },
  heatCell: {
    flex: 1,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  actionBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 12,
  },
  actionBtnText: {
    color: '#fff',
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
    padding: 18,
    flexGrow: 1,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
  },
  card: {
    borderRadius: 18,
    padding: 15,
    marginBottom: 9,
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  cardDay: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  cardTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaSmText: {
    fontSize: 8,
    fontWeight: '700',
  },
  chooseBtn: {
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chooseBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  canText: {
    fontSize: 12,
    fontWeight: '500',
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
    padding: 20,
    flexGrow: 1,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 18,
  },
  confirmCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 17,
    width: '100%',
    marginBottom: 14,
  },
  cardLbl: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  dateIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  timeVal: {
    fontSize: 12,
    color: '#6B7280',
  },
  attendLbl: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  attendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attendPerson: {
    alignItems: 'center',
  },
  attendAva: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  attendAvaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attendName: {
    fontSize: 10,
    color: '#6B7280',
  },
  bottom: {
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  gcalBtn: {
    backgroundColor: '#5B4FDB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  gcalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  shareBtn: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  shareBtnText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
});
