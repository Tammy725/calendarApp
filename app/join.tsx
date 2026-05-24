import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { roomsApi } from '@/lib/api/rooms';

export default function JoinScreen() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) {
      Alert.alert('Código requerido', 'Ingresa el código del plan');
      return;
    }
    setJoining(true);
    try {
      const rooms = await roomsApi.list();
      const match = rooms.find((r) => r.name.includes(code.trim().toUpperCase()));
      if (match) {
        await roomsApi.join(match.id);
        router.push(`/plan/${match.id}`);
      } else {
        Alert.alert('No encontrado', 'No hay un plan con ese código');
      }
    } catch {
      Alert.alert('Error', 'No se pudo unir al plan');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Unirse a un Plan</Text>
        <Text style={styles.subtitle}>Ingresa el código que te compartieron</Text>

        <TextInput
          style={styles.input}
          placeholder="Ej: PLAN-A1B2"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={joining}>
          {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinText}>Unirse</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  content: { padding: 24, gap: 16, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#11181C' },
  subtitle: { fontSize: 16, color: '#687076', textAlign: 'center' },
  input: {
    width: '100%', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 12,
    padding: 16, fontSize: 20, color: '#11181C', textAlign: 'center', letterSpacing: 4,
    marginTop: 20,
  },
  joinButton: {
    width: '100%', backgroundColor: '#0a7ea4', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10,
  },
  joinText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
