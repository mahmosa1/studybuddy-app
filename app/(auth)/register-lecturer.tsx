// app/(auth)/register-lecturer.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity
} from 'react-native';

export default function RegisterLecturerScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');

  const handleSubmit = () => {
    if (!email || !password || !username) {
      console.log('Missing required fields');
      return;
    }

    if (password !== confirmPassword) {
      console.log('Passwords do not match');
      return;
    }

    const payload = {
      role: 'lecturer',
      username,
      fullName,
      email,
      phone,
      institution,
      department,
      // בשלב מאוחר יותר נוסיף כאן: lecturerIdUrl, profileImageUrl
    };

    console.log('Lecturer register data:', payload);

    // בהמשך:
    // 1. Firebase Auth – יצירת משתמש
    // 2. Firestore – users collection (status: "pending")
    // 3. Supabase Storage – upload lecturer ID + profile picture
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Lecturer Registration</Text>
        <Text style={styles.subtitle}>
          Fill in your details so we can verify your lecturer account.
        </Text>

        <Text style={styles.label}>Username *</Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a unique username"
          placeholderTextColor="#6b7280"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your full name"
          placeholderTextColor="#6b7280"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="example@university.com"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter a strong password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Repeat your password"
          placeholderTextColor="#6b7280"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+972 ..."
          placeholderTextColor="#6b7280"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Institution *</Text>
        <TextInput
          style={styles.input}
          placeholder="Where do you teach?"
          placeholderTextColor="#6b7280"
          value={institution}
          onChangeText={setInstitution}
        />

        <Text style={styles.label}>Department / Faculty</Text>
        <TextInput
          style={styles.input}
          placeholder="Computer Science, Law, etc."
          placeholderTextColor="#6b7280"
          value={department}
          onChangeText={setDepartment}
        />

        {/* כפתורים להעלאת תעודת מרצה ותמונת פרופיל – סופבייס בהמשך */}
        <Text style={styles.label}>Upload Lecturer ID *</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => console.log('TODO: pick lecturer ID file')}
        >
          <Text style={styles.uploadText}>Upload Lecturer ID</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Profile Picture (Optional)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => console.log('TODO: pick lecturer profile image')}
        >
          <Text style={styles.uploadText}>Upload Profile Picture</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back to role selection</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#050816',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: '#e5e7eb',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  uploadButton: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  uploadText: {
    color: '#a855f7',
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 18,
  },
  backText: {
    color: '#a855f7',
  },
});
