// app/attachment-viewer.tsx
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { attachmentLooksLikeImage, attachmentLooksLikePdf } from '@/lib/feedAttachmentUtils';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

function decodeParam(v: string | string[] | undefined): string {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw == null || raw === '') return '';
  try {
    return decodeURIComponent(String(raw));
  } catch {
    return String(raw);
  }
}

export default function AttachmentViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; name?: string; mimeType?: string }>();
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const isHebrewUi = i18n.language === 'he';

  const file = useMemo(() => {
    const url = decodeParam(params.url);
    const name = decodeParam(params.name) || t('feed.attachmentViewer.title');
    const mimeType = decodeParam(params.mimeType);
    return { url, name, mimeType };
  }, [params.url, params.name, params.mimeType, t]);

  const [webLoadFailed, setWebLoadFailed] = useState(false);
  const [webLoading, setWebLoading] = useState(false);

  const isImage = attachmentLooksLikeImage(file);
  const isPdf = attachmentLooksLikePdf(file);

  const openExternal = () => {
    if (!file.url) return;
    Linking.openURL(file.url).catch(() => {});
  };

  if (!file.url) {
    return (
      <AppScreen>
        <AppHeader title={t('feed.attachmentViewer.title')} onBack={() => router.back()} />
        <View style={[styles.center, { paddingHorizontal: layout.screenPadding }]}>
          <Text style={[styles.message, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {t('feed.attachmentViewer.cannotPreview')}
          </Text>
          <PrimaryButton label={t('common.back')} onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </View>
      </AppScreen>
    );
  }

  const showPdfWeb = isPdf && !webLoadFailed;
  const showFallback = (!isImage && !showPdfWeb) || (isPdf && webLoadFailed);

  return (
    <AppScreen>
      <AppHeader title={t('feed.attachmentViewer.openFile')} onBack={() => router.back()} />
      <View style={[styles.body, { backgroundColor: colors.bg }]}>
        {isImage ? (
          <View style={styles.previewArea}>
            <Image source={{ uri: file.url }} style={styles.fullImage} resizeMode="contain" />
          </View>
        ) : showPdfWeb ? (
          <View style={styles.webWrap}>
            {webLoading ? (
              <View style={styles.webLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}
            <WebView
              source={{ uri: file.url }}
              style={[styles.webview, { opacity: webLoading ? 0 : 1 }]}
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              onError={() => {
                setWebLoadFailed(true);
                setWebLoading(false);
              }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
            />
          </View>
        ) : showFallback ? (
          <View style={[styles.fallback, { paddingHorizontal: layout.screenPadding }]}>
            <Ionicons name="document-text-outline" size={56} color={colors.textSecondary} />
            <Text style={[styles.fileName, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={3}>
              {file.name}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('feed.attachmentViewer.cannotPreview')}
            </Text>
          </View>
        ) : null}

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <PrimaryButton
            label={t('feed.attachmentViewer.openExternally')}
            onPress={openExternal}
            variant="secondary"
            style={{ marginVertical: spacing.sm }}
          />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  fullImage: {
    width: '100%',
    flex: 1,
    minHeight: 200,
  },
  webWrap: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: layout.screenPadding,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
