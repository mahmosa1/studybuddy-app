// app/(auth)/register-student.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { auth, db } from '@/lib/firebaseConfig';
import { uploadImageToSupabase } from '@/lib/upload';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

export default function RegisterStudentScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');

  // URLs של התמונות ב-Supabase
  const [studentCardUrl, setStudentCardUrl] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // ל-loading של העלאה והרשמה
  const [uploadingCard, setUploadingCard] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickAndUploadImage = async (type: 'card' | 'profile') => {
    // בקשת הרשאה לגלריה
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'We need access to your gallery to upload images.'
      );
      return;
    }

    // בחירת תמונה מהגלריה
    const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: 'images',   // 👈 כאן השינוי
     allowsEditing: true,
     quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;

    if (type === 'card') {
      setUploadingCard(true);
    } else {
      setUploadingProfile(true);
    }

    try {
      const folder = type === 'card' ? 'student-cards' : 'profile-pictures';
      const url = await uploadImageToSupabase(uri, folder);

      if (!url) {
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
        return;
      }

      if (type === 'card') {
        setStudentCardUrl(url);
      } else {
        setProfilePictureUrl(url);
      }
    } catch (err) {
      console.log('Image upload error:', err);
      Alert.alert('Error', 'Unexpected error while uploading image.');
    } finally {
      if (type === 'card') {
        setUploadingCard(false);
      } else {
        setUploadingProfile(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!email || !password || !username) {
      Alert.alert('Missing fields', 'Username, email and password are required.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    if (!studentCardUrl) {
      Alert.alert(
        'Student card required',
        'Please upload your student card before continuing.'
      );
      return;
    }

    try {
      setLoading(true);

      // 1) יצירת משתמש ב-Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      // 2) יצירת מסמך ב-Firestore (users collection)
      await setDoc(doc(db, 'users', uid), {
        uid,
        role: 'student',
        status: 'pending', // עד שהאדמין יאשר
        username,
        fullName,
        email,
        phone,
        institution,
        fieldOfStudy,
        studentCardUrl,
        profilePictureUrl,
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Registration complete',
        'Your account is pending approval by the admin.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(auth)/pending-approval');
            },
          },
        ]
      );
    } catch (err: any) {
      console.log('Register student error:', err);
      Alert.alert('Error', err?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.title}>Student Registration</Text>
        <Text style={styles.subtitle}>
          Fill in your details so we can create your StudyBuddy account.
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
          placeholder="example@student.com"
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

        <Text style={styles.label}>University / College</Text>
        <TextInput
          style={styles.input}
          placeholder="Where do you study?"
          placeholderTextColor="#6b7280"
          value={institution}
          onChangeText={setInstitution}
        />

        <Text style={styles.label}>Field of Study</Text>
        <TextInput
          style={styles.input}
          placeholder="Software Engineering, Law, etc."
          placeholderTextColor="#6b7280"
          value={fieldOfStudy}
          onChangeText={setFieldOfStudy}
        />

        {/* Upload Student Card */}
        <Text style={styles.label}>Upload Student Card *</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickAndUploadImage('card')}
          disabled={uploadingCard}
        >
          {uploadingCard ? (
            <ActivityIndicator color="#a855f7" />
          ) : (
            <Text style={styles.uploadText}>
              {studentCardUrl ? 'Student Card Uploaded ✓' : 'Upload Student Card'}
            </Text>
          )}
        </TouchableOpacity>

        {studentCardUrl && (
          <View style={{ marginTop: 8 }}>
            <Image source={{ uri: studentCardUrl }} style={styles.preview} />
          </View>
        )}

        {/* Upload Profile Picture */}
        <Text style={styles.label}>Profile Picture (Optional)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickAndUploadImage('profile')}
          disabled={uploadingProfile}
        >
          {uploadingProfile ? (
            <ActivityIndicator color="#a855f7" />
          ) : (
            <Text style={styles.uploadText}>
              {profilePictureUrl ? 'Profile Picture Uploaded ✓' : 'Upload Profile Picture'}
            </Text>
          )}
        </TouchableOpacity>

        {profilePictureUrl && (
          <View style={{ marginTop: 8 }}>
            <Image source={{ uri: profilePictureUrl }} style={styles.previewSmall} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading || uploadingCard}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Continue</Text>
          )}
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
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b5563',
    marginTop: 4,
  },
  uploadText: {
    color: '#a855f7',
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  previewSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#4f46e5',
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
