import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  2: '#E5E7EB',
};

const CELL_LABELS: Record<number, string> = {
  0: '4/4',
  1: '2/4',
  2: '0/4',
};

const OPTIONS = [
  { day: 'Viernes 17 ene', time: '6:00 – 8:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Viernes 17 ene', time: '8:00 – 10:00 PM · 2h', count: 4, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Jueves 16 ene', time: '7:00 – 9:00 PM · 2h', count: 3, color: '#10B981', bg: '#D1FAE5' },
  { day: 'Jueves 16 ene', time: '9:00 – 11:00 AM · 2h', count: 3, color: '#F59E0B', bg: '#FEF3C7' },
  { day: 'Miércoles 15 ene', time: '7:00 – 9:00 PM · 2h', count: 4, color: '#F59E0B', bg: '#FEF3C7' },
  { day: 'Miércoles 15 ene', time: '5:00 – 7:00 PM · 2h', count: 3, color: '#F59E0B', bg: '#FEF3C7' },
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  if (screen === 'inicio') {
    return (
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
          <View style={s4.gridScoreRow}>
            <View style={{ width: 28 }} />
            {DAYS.map((_, ci) => {
              const green = HEATMAP.filter(r => r[ci] === 0).length;
              return (
                <View key={ci} style={s4.dayCell}>
                  <Text style={[s4.scoreText, { color: green >= 5 ? '#10B981' : '#F59E0B' }]}>
                    {green}/8
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={s4.gridHeader}>
            <View style={{ width: 28 }} />
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
                  >
                    <Text style={[s4.cellLabel, {
                      color: v === 0 ? '#065F46' : v === 1 ? '#92400E' : '#9CA3AF',
                    }]}>
                      {CELL_LABELS[v]}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={s4.legend}>
          {[
            { color: '#10B981', label: 'Todos libres' },
            { color: '#F59E0B', label: 'Algunos' },
            { color: '#E5E7EB', label: 'Nadie' },
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
          {OPTIONS.map((o, i) => {
            const isGood = i < 3;
            const c = isGood ? '#10B981' : '#F59E0B';
            const cl = isGood ? '#D1FAE5' : '#FEF3C7';
            const selected = selectedOption === i;
            return (
              <TouchableOpacity
                key={o.day}
                style={[s5.card, {
                  backgroundColor: cl,
                  borderColor: selected ? c : c + '30',
                  borderWidth: selected ? 2.5 : 1.5,
                }]}
                onPress={() => setSelectedOption(i)}
              >
                <View style={s5.cardTop}>
                  <View>
                    <Text style={s5.cardDay}>{o.day}</Text>
                    <Text style={s5.cardTime}>{o.time}</Text>
                  </View>
                  <View style={[s5.badge, { backgroundColor: c }]}>
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
                  <TouchableOpacity
                    style={[s5.chooseBtn, { backgroundColor: c }]}
                    onPress={() => { setSelectedOption(i); setScreen('confirmado'); }}
                  >
                    <Text style={s5.chooseBtnText}>
                      {selected ? '✓ Elegido' : 'Elegir'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
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
    fontSize: 18,
    color: '#111827',
    fontWeight: '600',
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
    marginBottom: 8,
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
    flex: 1,
    gap: 4,
  },
  heatRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  hourCell: {
    width: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  hourLabel: {
    fontSize: 11,
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
    fontSize: 11,
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
