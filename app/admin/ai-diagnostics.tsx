import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  I18nManager,
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
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const router = useRouter();
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
        return { bg: colors.surfaceMuted, border: colors.success, text: colors.success };
      case 'weak_grounding':
        return { bg: colors.surfaceMuted, border: colors.warning, text: colors.warning };
      case 'no_sources':
        return { bg: colors.surfaceMuted, border: colors.warning, text: colors.warning };
      case 'fallback':
        return { bg: colors.surfaceMuted, border: colors.primary, text: colors.primary };
      case 'error':
        return { bg: colors.surfaceMuted, border: colors.danger, text: colors.danger };
      default:
        return { bg: colors.surfaceMuted, border: colors.border, text: colors.textSecondary };
    }
  };

  const localizeFeature = (feature: string) => {
    const normalized = feature.toLowerCase();
    if (normalized.includes('question')) return t('admin.aiDiagnostics.features.questions');
    if (normalized.includes('eval')) return t('admin.aiDiagnostics.features.evaluation');
    return feature;
  };

  const localizeQuality = (quality: QualityFilter) =>
    t(`admin.aiDiagnostics.quality.${quality}`);

  if (loadingUser) {
    return (
      <AppScreen>
        <LoadingState />
      </AppScreen>
    );
  }

  if (role !== 'admin') {
    return <Redirect href="/(tabs)/index" />;
  }

  return (
    <AppScreen>
      <AppHeader title={t('admin.aiDiagnostics.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.heroGlowAccent, { backgroundColor: colors.accent }]} />
          <View style={[styles.heroBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name="analytics-outline" size={14} color={colors.primary} />
            <Text style={[styles.heroBadgeText, { color: colors.textSecondary }]}>{t('admin.aiDiagnostics.title')}</Text>
          </View>
          <SectionTitle title={t('admin.aiDiagnostics.title')} subtitle={t('admin.aiDiagnostics.subtitle')} />
        </View>

        <AppCard style={[styles.filtersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.filtersTitle, { color: colors.textPrimary }]}>{t('admin.aiDiagnostics.filters')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {features.map((feature) => (
              <TouchableOpacity
                key={feature}
                style={[
                  styles.chip,
                  {
                    backgroundColor: featureFilter === feature ? colors.primary : colors.surfaceMuted,
                    borderColor: featureFilter === feature ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFeatureFilter(feature)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: featureFilter === feature ? colors.textOnPrimary : colors.textPrimary },
                  ]}
                >
                  {feature === 'all' ? t('admin.aiDiagnostics.allFeatures') : localizeFeature(feature)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={courseFilter}
            onChangeText={setCourseFilter}
            placeholder={t('admin.aiDiagnostics.coursePlaceholder')}
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.textPrimary }]}
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.inlineFilters}>
            {(['all', 'yes', 'no'] as ToggleFilter[]).map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: fallbackFilter === value ? colors.primary : colors.surfaceMuted,
                    borderColor: fallbackFilter === value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFallbackFilter(value)}
              >
                <Text style={[styles.smallChipText, { color: fallbackFilter === value ? colors.textOnPrimary : colors.textPrimary }]}>
                  {t(`admin.aiDiagnostics.fallback.${value}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inlineFilters}>
            {(['all', 'hit', 'miss', 'unknown'] as CacheFilter[]).map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: cacheFilter === value ? colors.primary : colors.surfaceMuted,
                    borderColor: cacheFilter === value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setCacheFilter(value)}
              >
                <Text style={[styles.smallChipText, { color: cacheFilter === value ? colors.textOnPrimary : colors.textPrimary }]}>
                  {t(`admin.aiDiagnostics.cache.${value}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inlineFilters}>
            {(['all', 'grounded', 'weak_grounding', 'no_sources', 'fallback', 'error', 'unknown'] as QualityFilter[]).map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: qualityFilter === value ? colors.primary : colors.surfaceMuted,
                    borderColor: qualityFilter === value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setQualityFilter(value)}
              >
                <Text style={[styles.smallChipText, { color: qualityFilter === value ? colors.textOnPrimary : colors.textPrimary }]}>
                  {value === 'all'
                    ? t('admin.aiDiagnostics.quality.all')
                    : t('admin.aiDiagnostics.quality.labelValue', { value: localizeQuality(value) })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </AppCard>

        {loading ? (
          <LoadingState label={t('admin.aiDiagnostics.loading')} />
        ) : filteredTraces.length === 0 ? (
          <AppCard style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <EmptyState title={t('admin.aiDiagnostics.emptyTitle')} subtitle={t('admin.aiDiagnostics.emptySubtitle')} />
          </AppCard>
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
              <AppCard key={trace.id} style={[styles.traceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.traceHeaderRow, isRtl && styles.rtlRow]}>
                  <Text style={[styles.traceFeature, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
                    {trace.traceType ? localizeFeature(trace.traceType) : '-'}
                  </Text>
                  <Text style={[styles.traceTime, { color: colors.textSecondary }]}>{timestamp}</Text>
                </View>
                <View
                  style={[
                    styles.qualityBadge,
                    { backgroundColor: qualityTheme.bg, borderColor: qualityTheme.border },
                  ]}
                >
                  <Text style={[styles.qualityBadgeText, { color: qualityTheme.text }]}>
                    {t('admin.aiDiagnostics.quality.labelValue', { value: localizeQuality(qualityState) })}
                  </Text>
                </View>
                <View style={[styles.metaGrid, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.metaLine, { color: colors.textPrimary }]}>userId: {trace.userId || '-'}</Text>
                  <Text style={[styles.metaLine, { color: colors.textPrimary }]}>courseId: {trace.courseId || '-'}</Text>
                  <Text style={[styles.metaLine, { color: colors.textPrimary }]}>latency: {trace.latencyMs ? `${trace.latencyMs}ms` : '-'}</Text>
                  <Text style={[styles.metaLine, { color: colors.textPrimary }]}>
                    {t('admin.aiDiagnostics.cacheLabel')}: {t(`admin.aiDiagnostics.cache.${cacheState}`)}
                  </Text>
                  <Text style={[styles.metaLine, { color: colors.textPrimary }]}>
                    {t('admin.aiDiagnostics.fallbackLabel')}: {t(`admin.aiDiagnostics.fallback.${trace.fallbackUsed ? 'yes' : 'no'}`)}
                  </Text>
                </View>
                <View style={[styles.techBlock, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.techLine, { color: colors.textSecondary }]}>
                    source chunks: {chunks.length ? chunks.join(', ') : '-'}
                  </Text>
                  <Text style={[styles.techLine, { color: colors.textSecondary }]}>
                    file references: {fileRefs.length ? fileRefs.join(', ') : '-'}
                  </Text>
                </View>
                {(trace.errorCode || trace.fallbackReason) ? (
                  <Text style={[styles.errorLine, { color: colors.danger }]}>
                    error: {trace.errorCode || trace.fallbackReason}
                  </Text>
                ) : null}
              </AppCard>
            );
          })
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    gap: 12,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    top: -72,
    right: -38,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: -52,
    left: -26,
    opacity: 0.1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginBottom: spacing.sm,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filtersCard: {
    borderRadius: 14,
    padding: 12,
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
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
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
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  traceCard: {
    borderRadius: 14,
    padding: 12,
    gap: 6,
    overflow: 'hidden',
  },
  traceHeaderRow: {
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
  },
  metaGrid: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  metaLine: {
    fontSize: 12,
  },
  techBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  techLine: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    paddingVertical: 6,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

