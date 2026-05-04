import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type TraceDoc = {
  id: string;
  traceType?: string;
  userId?: string;
  courseId?: string;
  latencyMs?: number;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
  sourceChunkIds?: string[];
  sourceFileIds?: string[];
  sourceFiles?: string[];
  errorCode?: string;
  fallbackReason?: string;
  qualityStatus?: 'grounded' | 'weak_grounding' | 'no_sources' | 'fallback' | 'error';
  createdAt?: any;
};

type ToggleFilter = 'all' | 'yes' | 'no';
type CacheFilter = 'all' | 'hit' | 'miss' | 'unknown';
type QualityFilter = 'all' | 'grounded' | 'weak_grounding' | 'no_sources' | 'fallback' | 'error' | 'unknown';

export default function AIDiagnosticsScreen() {
  const { t } = useTranslation();
  const { role, loading: loadingUser } = useUser();
  const [traces, setTraces] = useState<TraceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [fallbackFilter, setFallbackFilter] = useState<ToggleFilter>('all');
  const [cacheFilter, setCacheFilter] = useState<CacheFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');

  React.useEffect(() => {
    const q = query(collection(db, 'ragTraces'), orderBy('createdAt', 'desc'), limit(120));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TraceDoc[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return { id: docSnap.id, ...data };
        });
        setTraces(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const features = useMemo(() => {
    const unique = new Set(
      traces.map((trace) => String(trace.traceType || '').trim()).filter(Boolean)
    );
    return ['all', ...Array.from(unique)];
  }, [traces]);

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
      const featureOk = featureFilter === 'all' || trace.traceType === featureFilter;
      const courseOk =
        !courseFilter.trim() ||
        String(trace.courseId || '')
          .toLowerCase()
          .includes(courseFilter.trim().toLowerCase());
      const fallbackOk =
        fallbackFilter === 'all' ||
        (fallbackFilter === 'yes' ? trace.fallbackUsed === true : trace.fallbackUsed !== true);

      const cacheState: CacheFilter =
        typeof trace.cacheHit === 'boolean' ? (trace.cacheHit ? 'hit' : 'miss') : 'unknown';
      const cacheOk = cacheFilter === 'all' || cacheState === cacheFilter;
      const qualityState: QualityFilter = trace.qualityStatus || 'unknown';
      const qualityOk = qualityFilter === 'all' || qualityState === qualityFilter;

      return featureOk && courseOk && fallbackOk && cacheOk && qualityOk;
    });
  }, [cacheFilter, courseFilter, fallbackFilter, featureFilter, qualityFilter, traces]);

  const getQualityBadgeStyle = (quality: QualityFilter) => {
    switch (quality) {
      case 'grounded':
        return { bg: '#ecfdf5', border: '#86efac', text: '#166534' };
      case 'weak_grounding':
        return { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' };
      case 'no_sources':
        return { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' };
      case 'fallback':
        return { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' };
      case 'error':
        return { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' };
      default:
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' };
    }
  };

  if (loadingUser) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#047857" />
      </View>
    );
  }

  if (role !== 'admin') {
    return <Redirect href="/(tabs)/index" />;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('admin.aiDiagnostics.title')}</Text>
          <Text style={styles.subtitle}>{t('admin.aiDiagnostics.subtitle')}</Text>
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.filtersTitle}>{t('admin.aiDiagnostics.filters')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {features.map((feature) => (
              <TouchableOpacity
                key={feature}
                style={[
                  styles.chip,
                  featureFilter === feature && styles.chipActive,
                ]}
                onPress={() => setFeatureFilter(feature)}
              >
                <Text
                  style={[
                    styles.chipText,
                    featureFilter === feature && styles.chipTextActive,
                  ]}
                >
                  {feature === 'all' ? t('admin.aiDiagnostics.allFeatures') : feature}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={courseFilter}
            onChangeText={setCourseFilter}
            placeholder={t('admin.aiDiagnostics.coursePlaceholder')}
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />

          <View style={styles.inlineFilters}>
            {(['all', 'yes', 'no'] as ToggleFilter[]).map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.smallChip, fallbackFilter === value && styles.smallChipActive]}
                onPress={() => setFallbackFilter(value)}
              >
                <Text style={[styles.smallChipText, fallbackFilter === value && styles.smallChipTextActive]}>
                  {t(`admin.aiDiagnostics.fallback.${value}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inlineFilters}>
            {(['all', 'hit', 'miss', 'unknown'] as CacheFilter[]).map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.smallChip, cacheFilter === value && styles.smallChipActive]}
                onPress={() => setCacheFilter(value)}
              >
                <Text style={[styles.smallChipText, cacheFilter === value && styles.smallChipTextActive]}>
                  {t(`admin.aiDiagnostics.cache.${value}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inlineFilters}>
            {(['all', 'grounded', 'weak_grounding', 'no_sources', 'fallback', 'error', 'unknown'] as QualityFilter[]).map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.smallChip, qualityFilter === value && styles.smallChipActive]}
                onPress={() => setQualityFilter(value)}
              >
                <Text style={[styles.smallChipText, qualityFilter === value && styles.smallChipTextActive]}>
                  {value === 'all' ? 'Quality: all' : `Quality: ${value}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#047857" />
            <Text style={styles.helperText}>{t('admin.aiDiagnostics.loading')}</Text>
          </View>
        ) : filteredTraces.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={26} color="#6b7280" />
            <Text style={styles.emptyTitle}>{t('admin.aiDiagnostics.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('admin.aiDiagnostics.emptySubtitle')}</Text>
          </View>
        ) : (
          filteredTraces.map((trace) => {
            const cacheState: CacheFilter =
              typeof trace.cacheHit === 'boolean' ? (trace.cacheHit ? 'hit' : 'miss') : 'unknown';
            const timestamp =
              trace.createdAt?.toDate?.() instanceof Date
                ? trace.createdAt.toDate().toLocaleString()
                : '-';
            const qualityState: QualityFilter = trace.qualityStatus || 'unknown';
            const qualityTheme = getQualityBadgeStyle(qualityState);
            const chunks = trace.sourceChunkIds || [];
            const fileRefs = trace.sourceFiles?.length ? trace.sourceFiles : trace.sourceFileIds || [];
            return (
              <View key={trace.id} style={styles.traceCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.traceFeature}>{trace.traceType || '-'}</Text>
                  <Text style={styles.traceTime}>{timestamp}</Text>
                </View>
                <View
                  style={[
                    styles.qualityBadge,
                    { backgroundColor: qualityTheme.bg, borderColor: qualityTheme.border },
                  ]}
                >
                  <Text style={[styles.qualityBadgeText, { color: qualityTheme.text }]}>
                    quality: {qualityState}
                  </Text>
                </View>

                <Text style={styles.lineItem}>userId: {trace.userId || '-'}</Text>
                <Text style={styles.lineItem}>courseId: {trace.courseId || '-'}</Text>
                <Text style={styles.lineItem}>latency: {trace.latencyMs ? `${trace.latencyMs}ms` : '-'}</Text>
                <Text style={styles.lineItem}>cache: {cacheState}</Text>
                <Text style={styles.lineItem}>fallback: {trace.fallbackUsed ? 'yes' : 'no'}</Text>
                <Text style={styles.lineItem}>
                  source chunks: {chunks.length ? chunks.join(', ') : '-'}
                </Text>
                <Text style={styles.lineItem}>
                  file references: {fileRefs.length ? fileRefs.join(', ') : '-'}
                </Text>
                {(trace.errorCode || trace.fallbackReason) ? (
                  <Text style={styles.errorLine}>
                    error: {trace.errorCode || trace.fallbackReason}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 12,
  },
  header: {
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13,
  },
  filtersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#047857',
  },
  chipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#047857',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  inlineFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  smallChipActive: {
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  smallChipTextActive: {
    color: '#047857',
  },
  traceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  traceFeature: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  traceTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  lineItem: {
    fontSize: 12,
    color: '#374151',
  },
  qualityBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  qualityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  errorLine: {
    marginTop: 4,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    gap: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
  },
});

