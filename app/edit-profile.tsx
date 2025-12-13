// app/edit-profile.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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
import { uploadImageToSupabase } from '@/lib/upload';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [department, setDepartment] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || '');
          setFullName(data.fullName || '');
          setPhone(data.phone || '');
          setInstitution(data.institution || '');
          setFieldOfStudy(data.fieldOfStudy || '');
          setDepartment(data.department || '');
          setProfilePictureUrl(data.profilePictureUrl || null);
          setRole(data.role || '');
        }
      } catch (err) {
        console.log('Error loading profile:', err);
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handlePickImage = async () => {
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
    setUploading(true);

    try {
      const folder = role === 'lecturer' 
        ? 'lecturer-profile-pictures' 
        : 'profile-pictures';
      const url = await uploadImageToSupabase(uri, folder);
      if (url) {
        setProfilePictureUrl(url);
      } else {
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
      }
    } catch (err) {
      console.log('Image upload error:', err);
      Alert.alert('Error', 'Unexpected error while uploading image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        institution: institution.trim() || null,
        fieldOfStudy: fieldOfStudy.trim() || null,
        department: department.trim() || null,
        profilePictureUrl: profilePictureUrl || null,
      });

      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.log('Error updating profile:', err);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#047857" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Edit Profile</Text>
        <Text style={styles.subtitle}>
          Update your profile information
        </Text>

        <View style={styles.card}>
          {/* Profile Picture */}
          <Text style={styles.label}>Profile Picture</Text>
          <View style={styles.avatarSection}>
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(fullName || username || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handlePickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#047857" />
              ) : (
                <Text style={styles.uploadButtonText}>
                  {profilePictureUrl ? 'Change Picture' : 'Upload Picture'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Username */}
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#6b7280"
            value={username}
            onChangeText={setUsername}
          />

          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            placeholderTextColor="#6b7280"
            value={fullName}
            onChangeText={setFullName}
          />

          {/* Phone */}
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+972 ..."
            placeholderTextColor="#6b7280"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* Institution */}
          <Text style={styles.label}>
            {role === 'lecturer' ? 'Institution' : 'University / College'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={
              role === 'lecturer'
                ? 'Where do you teach?'
                : 'Where do you study?'
            }
            placeholderTextColor="#6b7280"
            value={institution}
            onChangeText={setInstitution}
          />

          {/* Field of Study / Department */}
          {role === 'student' ? (
            <>
              <Text style={styles.label}>Field of Study</Text>
              <TextInput
                style={styles.input}
                placeholder="Software Engineering, Law, etc."
                placeholderTextColor="#6b7280"
                value={fieldOfStudy}
                onChangeText={setFieldOfStudy}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Department / Faculty</Text>
              <TextInput
                style={styles.input}
                placeholder="Computer Science, Law, etc."
                placeholderTextColor="#6b7280"
                value={department}
                onChangeText={setDepartment}
              />
            </>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || !username.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#047857',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '700',
  },
  uploadButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: '#fff7ed',
  },
  uploadButtonText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 14,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

