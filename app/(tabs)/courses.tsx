// app/(tabs)/courses.tsx
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MOCK_COURSES = [
  { id: '1', name: 'Linear Algebra', lecturer: 'Dr. Cohen' },
  { id: '2', name: 'Operating Systems', lecturer: 'Prof. Levy' },
];

export default function StudentCoursesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Courses</Text>

      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add New Course</Text>
      </TouchableOpacity>

      <FlatList
        data={MOCK_COURSES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16 }}
        renderItem={({ item }) => (
          <View style={styles.courseCard}>
            <Text style={styles.courseName}>{item.name}</Text>
            <Text style={styles.lecturerName}>{item.lecturer}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  courseCard: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  courseName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  lecturerName: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 4,
  },
});
