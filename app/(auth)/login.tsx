import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { handleGoogleSignIn } from '@/lib/api/auth';
import { loadUser } from '@/lib/api/auth';

export default function LoginScreen() {
  const handleLogin = async () => {
    const user = await handleGoogleSignIn();
    if (user) {
      await loadUser();
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>MiApp</Text>
        <Text style={styles.subtitle}>Encuentra el mejor momento para quedar</Text>

        <TouchableOpacity style={styles.googleButton} onPress={handleLogin}>
          <Text style={styles.googleButtonText}>Iniciar sesión con Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Conecta tu Google Calendar para ver tu disponibilidad y coordinarte con amigos
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  content: { alignItems: 'center', padding: 24, gap: 20, maxWidth: 340 },
  title: { fontSize: 40, fontWeight: '700', color: '#11181C' },
  subtitle: { fontSize: 18, color: '#687076', textAlign: 'center' },
  googleButton: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 20, width: '100%', alignItems: 'center',
  },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  disclaimer: { fontSize: 13, color: '#adb5bd', textAlign: 'center', marginTop: 10 },
});
