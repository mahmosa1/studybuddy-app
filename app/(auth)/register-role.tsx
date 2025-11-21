// app/(auth)/register-role.tsx
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RegisterRoleScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Choose your role</Text>

      <TouchableOpacity
        style={[styles.button, styles.studentButton]}
        onPress={() => router.push('/(auth)/register-student')}
      >
        <Text style={styles.buttonText}>I am a Student</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.lecturerButton]}
        onPress={() => router.push('/(auth)/register-lecturer')}
      >
        <Text style={styles.buttonText}>I am a Lecturer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/login')}
        style={styles.linkWrapper}
      >
        <Text style={styles.linkText}>
          Already have an account? <Text style={styles.linkTextBold}>Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    backgroundColor: '#050816',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 32,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  studentButton: {
    backgroundColor: '#4f46e5',
  },
  lecturerButton: {
    backgroundColor: '#7c3aed',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  linkWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#9ca3af',
  },
  linkTextBold: {
    color: '#a855f7',
    fontWeight: '600',
  },
});
