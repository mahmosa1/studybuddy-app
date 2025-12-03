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

  // Supabase image URLs
  const [studentCardUrl, setStudentCardUrl] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  const [uploadingCard, setUploadingCard] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickAndUploadImage = async (type: 'card' | 'profile') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'We need access to your gallery to upload images.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
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
        'Please upload your student card before continuing.',
      );
      return;
    }

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        role: 'student',
        status: 'pending',
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
        ],
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
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Student Registration</Text>
          <Text style={styles.subtitle}>
            Fill in your details so we can create your StudyBuddy account.
          </Text>

          {/* Username */}
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a unique username"
            placeholderTextColor="#9ca3af"
            value={username}
            onChangeText={setUsername}
          />

          {/* Full name */}
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            placeholderTextColor="#9ca3af"
            value={fullName}
            onChangeText={setFullName}
          />

          {/* Email */}
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="example@student.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password */}
          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter a strong password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Confirm password */}
          <Text style={styles.label}>Confirm Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat your password"
            placeholderTextColor="#9ca3af"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {/* Phone */}
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+972 ..."
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* Institution */}
          <Text style={styles.label}>University / College</Text>
          <TextInput
            style={styles.input}
            placeholder="Where do you study?"
            placeholderTextColor="#9ca3af"
            value={institution}
            onChangeText={setInstitution}
          />

          {/* Field of study */}
          <Text style={styles.label}>Field of Study</Text>
          <TextInput
            style={styles.input}
            placeholder="Software Engineering, Law, etc."
            placeholderTextColor="#9ca3af"
            value={fieldOfStudy}
            onChangeText={setFieldOfStudy}
          />

          {/* Student card */}
          <Text style={styles.label}>Upload Student Card *</Text>
          <TouchableOpacity
            style={[
              styles.uploadButton,
              studentCardUrl && styles.uploadButtonFilled,
            ]}
            onPress={() => pickAndUploadImage('card')}
            disabled={uploadingCard}
          >
            {uploadingCard ? (
              <ActivityIndicator color="#ff8a00" />
            ) : (
              <Text
                style={[
                  styles.uploadText,
                  studentCardUrl && styles.uploadTextFilled,
                ]}
              >
                {studentCardUrl ? 'Student Card Uploaded ✓' : 'Upload Student Card'}
              </Text>
            )}
          </TouchableOpacity>

          {studentCardUrl && (
            <View style={{ marginTop: 8 }}>
              <Image source={{ uri: studentCardUrl }} style={styles.preview} />
            </View>
          )}

          {/* Profile picture */}
          <Text style={styles.label}>Profile Picture (Optional)</Text>
          <TouchableOpacity
            style={[
              styles.uploadButton,
              profilePictureUrl && styles.uploadButtonFilled,
            ]}
            onPress={() => pickAndUploadImage('profile')}
            disabled={uploadingProfile}
          >
            {uploadingProfile ? (
              <ActivityIndicator color="#ff8a00" />
            ) : (
              <Text
                style={[
                  styles.uploadText,
                  profilePictureUrl && styles.uploadTextFilled,
                ]}
              >
                {profilePictureUrl
                  ? 'Profile Picture Uploaded ✓'
                  : 'Upload Profile Picture'}
              </Text>
            )}
          </TouchableOpacity>

          {profilePictureUrl && (
            <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
              <Image source={{ uri: profilePictureUrl }} style={styles.previewSmall} />
            </View>
          )}

          {/* Submit */}
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

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back to role selection</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: '#f5f7fb',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  uploadButton: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ff8a00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ec',
  },
  uploadButtonFilled: {
    backgroundColor: '#ff8a00',
  },
  uploadText: {
    color: '#ff8a00',
    fontWeight: '600',
    fontSize: 13,
  },
  uploadTextFilled: {
    color: '#ffffff',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  previewSmall: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#ff8a00',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
  },
  backText: {
    color: '#ff8a00',
    fontSize: 13,
    fontWeight: '500',
  },
});
