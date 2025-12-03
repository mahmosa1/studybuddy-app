// app/(tabs)/search.tsx
import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type SearchMode = 'users' | 'studybuddy';

type FakeResult = {
  id: string;
  title: string;
  subtitle?: string;
};

export default function SearchScreen() {
  const [mode, setMode] = useState<SearchMode>('users');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FakeResult[]>([]);

  const handleSearch = () => {
    // For now: just dummy data so we see the UI.
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (mode === 'users') {
      setResults([
        {
          id: '1',
          title: 'Mahmoud · Software Engineering',
          subtitle: 'SCE · Evening sessions',
        },
        {
          id: '2',
          title: 'Ahmad · Computer Science',
          subtitle: 'BGU · Weekend sessions',
        },
      ]);
    } else {
      setResults([
        {
          id: '1',
          title: `Study buddy for "${query}"`,
          subtitle: '2 matches found (dummy data)',
        },
      ]);
    }
  };

  const renderResult = ({ item }: { item: FakeResult }) => (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{item.title}</Text>
      {item.subtitle ? (
        <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* כותרת Search באמצע למעלה */}
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>
        Find students or a study buddy that matches your courses and schedule.
      </Text>

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'users' && styles.modeButtonActive,
          ]}
          onPress={() => setMode('users')}
        >
          <Text
            style={[
              styles.modeText,
              mode === 'users' && styles.modeTextActive,
            ]}
          >
            Users
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'studybuddy' && styles.modeButtonActive,
          ]}
          onPress={() => setMode('studybuddy')}
        >
          <Text
            style={[
              styles.modeText,
              mode === 'studybuddy' && styles.modeTextActive,
            ]}
          >
            Study Buddy
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters / inputs */}
      <View style={styles.formBox}>
        <Text style={styles.label}>
          {mode === 'users' ? 'Name / Username' : 'Course name'}
        </Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={
            mode === 'users' ? 'Search by name or username' : 'e.g. Calculus 1'
          }
          placeholderTextColor="#9ca3af"
        />

        {mode === 'users' ? (
          <>
            <Text style={styles.label}>Institution (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="University / College"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Field of study (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Software Engineering, Law, etc."
              placeholderTextColor="#9ca3af"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Preferred time</Text>
            <TextInput
              style={styles.input}
              placeholder="Evening, Morning, Weekends..."
              placeholderTextColor="#9ca3af"
            />
          </>
        )}

        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {results.length === 0 ? (
        <Text style={styles.emptyText}>
          No results yet. Try searching for something.
        </Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const ORANGE = '#f97316';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  // כותרת Search באמצע
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 18,
  },

  // toggle
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  modeButtonActive: {
    backgroundColor: ORANGE,
  },
  modeText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#ffffff',
  },

  // box של הפילטרים
  formBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  label: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  searchButton: {
    marginTop: 18,
    backgroundColor: ORANGE,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },

  emptyText: {
    marginTop: 18,
    fontSize: 13,
    color: '#6b7280',
  },

  // תוצאות
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  resultTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  resultSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
});

export { };

