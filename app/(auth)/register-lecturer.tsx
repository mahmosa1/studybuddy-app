// app/(auth)/register-lecturer.tsx
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebaseConfig';
import { uploadImageToSupabase } from '@/lib/upload';

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

  const [lecturerIdUrl, setLecturerIdUrl] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickAndUploadImage = async (type: 'id' | 'profile') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'We need access to your gallery to upload images.'
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

    if (type === 'id') setUploadingId(true);
    else setUploadingProfile(true);

    try {
      const folder =
        type === 'id' ? 'lecturer-ids' : 'lecturer-profile-pictures';

      const url = await uploadImageToSupabase(uri, folder as any);
      if (!url) {
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
        return;
      }

      if (type === 'id') setLecturerIdUrl(url);
      else setProfilePictureUrl(url);
    } catch (err) {
      console.log('Lecturer image upload error:', err);
      Alert.alert('Error', 'Unexpected error while uploading image.');
    } finally {
      if (type === 'id') setUploadingId(false);
      else setUploadingProfile(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password || !username) {
      Alert.alert(
        'Missing fields',
        'Username, email and password are required.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    if (!institution) {
      Alert.alert('Institution required', 'Please fill where you teach.');
      return;
    }

    if (!lecturerIdUrl) {
      Alert.alert(
        'Lecturer ID required',
        'Please upload your lecturer ID before continuing.'
      );
      return;
    }

    try {
      setLoading(true);

      // 1) Firebase Auth
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const uid = cred.user.uid;

      // 2) Firestore – users collection
      await setDoc(doc(db, 'users', uid), {
        uid,
        role: 'lecturer',
        status: 'pending', // עד שהאדמין יאשר
        username,
        fullName,
        email,
        phone,
        institution,
        department,
        lecturerIdUrl,
        profilePictureUrl,
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Registration complete',
        'Your lecturer account is pending admin approval.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/pending-approval'),
          },
        ]
      );
    } catch (err: any) {
      console.log('Register lecturer error:', err);
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
        <Text style={styles.title}>Lecturer Registration</Text>
        <Text style={styles.subtitle}>
          Fill in your details so we can verify your lecturer account.
        </Text>

        <Text style={styles.label}>Username *</Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a unique username"
          placeholderTextColor="#9CA3AF"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your full name"
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="example@university.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter a strong password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Repeat your password"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+972 ..."
          placeholderTextColor="#9CA3AF"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Institution *</Text>
        <TextInput
          style={styles.input}
          placeholder="Where do you teach?"
          placeholderTextColor="#9CA3AF"
          value={institution}
          onChangeText={setInstitution}
        />

        <Text style={styles.label}>Department / Faculty</Text>
        <TextInput
          style={styles.input}
          placeholder="Computer Science, Law, etc."
          placeholderTextColor="#9CA3AF"
          value={department}
          onChangeText={setDepartment}
        />

        {/* Lecturer ID */}
        <Text style={styles.label}>Upload Lecturer ID *</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickAndUploadImage('id')}
          disabled={uploadingId}
        >
          {uploadingId ? (
            <ActivityIndicator color="#F97316" />
          ) : (
            <Text style={styles.uploadText}>
              {lecturerIdUrl ? 'Lecturer ID Uploaded ✓' : 'Upload Lecturer ID'}
            </Text>
          )}
        </TouchableOpacity>

        {lecturerIdUrl && (
          <View style={{ marginTop: 8 }}>
            <Image source={{ uri: lecturerIdUrl }} style={styles.preview} />
          </View>
        )}

        {/* Profile picture */}
        <Text style={styles.label}>Profile Picture (Optional)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickAndUploadImage('profile')}
          disabled={uploadingProfile}
        >
          {uploadingProfile ? (
            <ActivityIndicator color="#F97316" />
          ) : (
            <Text style={styles.uploadText}>
              {profilePictureUrl
                ? 'Profile Picture Uploaded ✓'
                : 'Upload Profile Picture'}
            </Text>
          )}
        </TouchableOpacity>

        {profilePictureUrl && (
          <View style={{ marginTop: 8 }}>
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.previewSmall}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading || uploadingId}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
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
    backgroundColor: '#F5F5F7',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploadButton: {
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginTop: 4,
  },
  uploadText: {
    color: '#F97316',
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
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: 999,
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
    color: '#ff8a00',
  },
});
