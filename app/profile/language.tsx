// app/profile/language.tsx — App language selection (full screen)
import { saveLanguage } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY_GREEN = '#047857';

export default function ProfileLanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';
  const [current, setCurrent] = useState(i18n.language);

  useEffect(() => {
    setCurrent(i18n.language);
  }, [i18n.language]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.title, isHebrewUi && styles.rtlText]}>{t('profile.selectLanguage')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.option, current === 'en' && styles.optionSelected]}
          onPress={async () => {
            await saveLanguage('en');
            await i18n.changeLanguage('en');
            setCurrent('en');
          }}
        >
          <Ionicons
            name={current === 'en' ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={current === 'en' ? PRIMARY_GREEN : '#9ca3af'}
          />
          <Text style={[styles.optionText, current === 'en' && styles.optionTextSelected]}>
            {t('profile.english')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, current === 'he' && styles.optionSelected]}
          onPress={async () => {
            await saveLanguage('he');
            await i18n.changeLanguage('he');
            setCurrent('he');
          }}
        >
          <Ionicons
            name={current === 'he' ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={current === 'he' ? PRIMARY_GREEN : '#9ca3af'}
          />
          <Text style={[styles.optionText, current === 'he' && styles.optionTextSelected]}>
            {t('profile.hebrew')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  card: { margin: 20, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  optionSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: PRIMARY_GREEN,
    borderWidth: 2,
  },
  optionText: { fontSize: 16, fontWeight: '500', color: '#111827', flex: 1 },
  optionTextSelected: { color: PRIMARY_GREEN, fontWeight: '600' },
});
