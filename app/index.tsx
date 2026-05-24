import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const PEOPLE = ['Vos', 'María', 'Carlos', 'Sofía'];
const COLORS = ['#534AB7', '#0F6E56', '#993C1D', '#993556'];
const DAYS = ['Lun 26', 'Mar 27', 'Mié 28', 'Jue 29', 'Vie 30'];
const HOURS = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const INIT_BUSY: Record<string, string[]> = {
  'Vos':    ['Lun 26-9:00','Lun 26-10:00','Mar 27-14:00','Mar 27-15:00','Mié 28-9:00','Jue 29-11:00','Jue 29-12:00'],
  'María':  ['Lun 26-11:00','Lun 26-12:00','Mié 28-14:00','Mié 28-15:00','Vie 30-9:00','Vie 30-10:00'],
  'Carlos': ['Mar 27-9:00','Mar 27-10:00','Jue 29-14:00','Vie 30-14:00','Vie 30-15:00','Lun 26-15:00'],
  'Sofía':  ['Mié 28-10:00','Mié 28-11:00','Jue 29-9:00','Vie 30-11:00','Vie 30-12:00','Mar 27-16:00'],
};

export default function HomeScreen() {
  const [screen, setScreen] = useState('inicio');
  const [busy] = useState(INIT_BUSY);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [groupCode] = useState('PLAN-7X4K');

  const getCount = (day: string, hour: string) => {
    const slot = `${day}-${hour}`;
    return PEOPLE.filter(p => !busy[p].includes(slot)).length;
  };

  const getBg = (count: number) => {
    if (count === 4) return '#1D9E75';
    if (count === 3) return '#5DCAA5';
    if (count === 2) return '#EF9F27';
    if (count === 1) return '#F0997B';
    return '#F7C1C1';
  };

  const getTextColor = (count: number) => (count >= 2 ? '#fff' : '#993C1D');

  const bestSlots = () => {
    const slots: { day: string; hour: string; count: number }[] = [];
    DAYS.forEach(d => HOURS.forEach(h => {
      const c = getCount(d, h);
      slots.push({ day: d, hour: h, count: c });
    }));
    return slots.sort((a, b) => b.count - a.count).slice(0, 3);
  };

  if (screen === 'inicio') {
    return (
      <View style={styles.wrap}>
        <View style={styles.nav}>
          <Text style={styles.navTitleCenter}>📅 CuandoPueden</Text>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🗓️</Text>
            <Text style={styles.h1}>Coordiná planes sin el caos</Text>
            <Text style={styles.sub}>Compará disponibilidad con tu grupo y encontrá el momento perfecto para todos.</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => setScreen('grupo')}>
            <Text style={styles.btnText}>Crear grupo nuevo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOut}>
            <Text style={styles.btnOutText}>Unirme a un grupo existente</Text>
          </TouchableOpacity>
          <View style={styles.howSection}>
            <Text style={styles.howTitle}>¿Cómo funciona?</Text>
            {[
              ['1. Creás un grupo', 'Compartís un código o link con tus amigos'],
              ['2. Conectan sus calendarios', 'Cada uno vincula el suyo con un clic'],
              ['3. Ven cuándo coinciden', 'La app muestra los mejores momentos automáticamente'],
            ].map(([t, d]) => (
              <View key={t} style={styles.howRow}>
                <View style={styles.howDot} />
                <View style={styles.howContent}>
                  <Text style={styles.howStep}>{t}</Text>
                  <Text style={styles.howDesc}>{d}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'grupo') {
    return (
      <View style={styles.wrap}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => setScreen('inicio')}>
            <Text style={styles.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Tu grupo</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.h1}>Plan del finde 🎉</Text>
          <Text style={styles.sub}>Compartí este código con tu grupo para que se unan.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Código del grupo</Text>
            <Text style={styles.code}>{groupCode}</Text>
            <Text style={styles.codeHint}>o compartí el link: cuandopueden.app/{groupCode.toLowerCase()}</Text>
          </View>
          <Text style={styles.sectionLabel}>Miembros ({PEOPLE.length}/10)</Text>
          {PEOPLE.map((p, i) => (
            <View key={p} style={styles.personRow}>
              <View style={[styles.avatar, { backgroundColor: COLORS[i] }]}>
                <Text style={styles.avatarText}>{p[0]}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{p}</Text>
                <Text style={[styles.personStatus, { color: i < 3 ? '#1D9E75' : '#888' }]}>
                  {i < 3 ? '✓ Calendario conectado' : '⏳ Pendiente'}
                </Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.btn} onPress={() => setScreen('grilla')}>
            <Text style={styles.btnText}>Ver disponibilidad →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'grilla') {
    return (
      <View style={styles.wrap}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => setScreen('grupo')}>
            <Text style={styles.back}>← Grupo</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Disponibilidad</Text>
          <Text style={styles.weekLabel}>Semana 26/5</Text>
        </View>
        <View style={styles.legend}>
          {[
            { color: '#1D9E75', label: 'Todos (4)' },
            { color: '#5DCAA5', label: '3' },
            { color: '#EF9F27', label: '2' },
            { color: '#F0997B', label: '1' },
          ].map(({ color, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.gridHint}>Tocá un horario para ver detalles</Text>
        <ScrollView horizontal style={styles.gridScroll}>
          <View>
            <View style={styles.gridHeader}>
              <View style={styles.cornerCell} />
              {DAYS.map(d => (
                <View key={d} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{d}</Text>
                </View>
              ))}
            </View>
            {HOURS.map(h => (
              <View key={h} style={styles.gridRow}>
                <View style={styles.hourCell}>
                  <Text style={styles.hourText}>{h}</Text>
                </View>
                {DAYS.map(d => {
                  const count = getCount(d, h);
                  const slot = `${d}-${h}`;
                  const isSel = selected === slot;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.gridCell,
                        { backgroundColor: getBg(count) },
                        isSel && styles.gridCellSelected,
                      ]}
                      onPress={() => setSelected(isSel ? null : slot)}
                    >
                      <Text style={[styles.gridCellText, { color: getTextColor(count) }]}>
                        {count}/4
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        {selected && (() => {
          const parts = selected.split('-');
          const h = parts.pop()!;
          const d = parts.join('-');
          const avail = PEOPLE.filter(p => !busy[p].includes(selected));
          const occ = PEOPLE.filter(p => busy[p].includes(selected));
          return (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{d} · {h}</Text>
              <Text style={styles.detailAvail}>✓ Pueden: {avail.join(', ') || '—'}</Text>
              <Text style={styles.detailBusy}>✗ Ocupados: {occ.join(', ') || '—'}</Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => { setConfirmed(selected); setScreen('resultado'); }}>
                <Text style={styles.confirmBtnText}>Confirmar este horario ✓</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
        <TouchableOpacity style={styles.btnOut} onPress={() => setScreen('resultado')}>
          <Text style={styles.btnOutText}>Ver mejores horarios sugeridos →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const best = bestSlots();
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => setScreen('grilla')}>
          <Text style={styles.back}>← Grilla</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Mejores horarios</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {confirmed && (() => {
          const parts = confirmed.split('-');
          const h = parts.pop()!;
          const d = parts.join('-');
          return (
            <View style={styles.confirmedBanner}>
              <Text style={styles.confirmedTitle}>Plan confirmado</Text>
              <Text style={styles.confirmedDetail}>
                {d} a las {h}{'\n'}Se notificó a los 4 miembros del grupo.
              </Text>
            </View>
          );
        })()}
        <Text style={styles.sectionLabel}>Sugeridos por la app</Text>
        {best.map(({ day, hour, count }, i) => (
          <View key={`${day}-${hour}`} style={[styles.suggestionCard, i === 0 && styles.suggestionBest]}>
            <View style={styles.suggestionHeader}>
              <View>
                <Text style={styles.suggestionTime}>{day} · {hour}</Text>
                <Text style={[styles.suggestionCount, { color: count === 4 ? '#1D9E75' : '#EF9F27' }]}>
                  {count === 4 ? '✓ Todos pueden' : `${count} de 4 pueden`}
                </Text>
                <Text style={styles.suggestionPeople}>
                  {PEOPLE.filter(p => !busy[p].includes(`${day}-${hour}`)).join(', ')}
                </Text>
              </View>
              <View style={styles.suggestionScore}>
                <Text style={[styles.scoreText, { color: getBg(count) }]}>{count}/4</Text>
                {i === 0 && <Text style={styles.bestLabel}>MEJOR</Text>}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.elegirBtn, confirmed === `${day}-${hour}` && styles.elegirBtnActive]}
              onPress={() => setConfirmed(`${day}-${hour}`)}
            >
              <Text style={[styles.elegirBtnText, confirmed === `${day}-${hour}` && styles.elegirBtnTextActive]}>
                {confirmed === `${day}-${hour}` ? '✓ Confirmado' : 'Elegir este horario'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.btnOut} onPress={() => setScreen('grilla')}>
          <Text style={styles.btnOutText}>← Ver grilla completa</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  navTitleCenter: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#534AB7',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  back: {
    fontSize: 13,
    color: '#534AB7',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    backgroundColor: '#534AB7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnOut: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#534AB7',
  },
  btnOutText: {
    color: '#534AB7',
    fontSize: 15,
    fontWeight: '600',
  },
  howSection: {
    marginTop: 24,
  },
  howTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  howRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  howDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#534AB7',
    marginTop: 5,
  },
  howContent: {
    flex: 1,
  },
  howStep: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  howDesc: {
    fontSize: 13,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  code: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#534AB7',
  },
  codeHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 4,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  personStatus: {
    fontSize: 12,
  },
  weekLabel: {
    fontSize: 12,
    color: '#888',
  },
  legend: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#fff',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
    color: '#666',
  },
  gridHint: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  gridScroll: {
    paddingHorizontal: 8,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cornerCell: {
    width: 36,
    padding: 4,
  },
  dayHeaderCell: {
    width: 56,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontWeight: '600',
    color: '#444',
    fontSize: 11,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourCell: {
    width: 36,
    paddingRight: 4,
    alignItems: 'flex-end',
  },
  hourText: {
    fontSize: 10,
    color: '#888',
  },
  gridCell: {
    width: 56,
    height: 28,
    margin: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCellSelected: {
    borderWidth: 2,
    borderColor: '#26215C',
  },
  gridCellText: {
    fontWeight: '600',
    fontSize: 11,
  },
  detailCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#534AB7',
    borderRadius: 12,
    padding: 14,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  detailAvail: {
    fontSize: 12,
    color: '#1D9E75',
    marginBottom: 4,
  },
  detailBusy: {
    fontSize: 12,
    color: '#E24B4A',
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: '#534AB7',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmedBanner: {
    backgroundColor: '#E1F5EE',
    borderWidth: 1,
    borderColor: '#1D9E75',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  confirmedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#085041',
  },
  confirmedDetail: {
    fontSize: 13,
    color: '#0F6E56',
    marginTop: 2,
  },
  suggestionCard: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  suggestionBest: {
    borderLeftWidth: 3,
    borderLeftColor: '#1D9E75',
    borderColor: '#e5e5e5',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  suggestionCount: {
    fontSize: 13,
    marginTop: 2,
  },
  suggestionPeople: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  suggestionScore: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
  },
  bestLabel: {
    fontSize: 10,
    color: '#1D9E75',
    fontWeight: '600',
  },
  elegirBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#534AB7',
  },
  elegirBtnActive: {
    backgroundColor: '#534AB7',
    borderWidth: 0,
  },
  elegirBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#534AB7',
  },
  elegirBtnTextActive: {
    color: '#fff',
  },
});
