import {
  ACADEMIC_INSTITUTIONS,
  formatInstitutionPickerLabel,
  getInstitutionByName,
} from '@/constants/academicInstitutions';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  I18nManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AcademicInstitutionPickerProps = {
  value: string;
  onChange: (institutionName: string) => void;
  placeholder: string;
};

export function AcademicInstitutionPicker({ value, onChange, placeholder }: AcademicInstitutionPickerProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';
  const isRtl = I18nManager.isRTL;
  const [visible, setVisible] = useState(false);

  const selected = useMemo(() => getInstitutionByName(value), [value]);
  const displayValue = selected ? formatInstitutionPickerLabel(selected) : '';

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: selected ? colors.primary : colors.border,
          },
          isRtl && styles.triggerRtl,
        ]}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('auth.selectInstitution')}
      >
        <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
        <Text
          style={[
            styles.triggerText,
            { color: selected ? colors.textPrimary : colors.textSecondary },
            isHebrewUi && styles.rtlText,
          ]}
          numberOfLines={2}
        >
          {displayValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable
          style={[
            styles.modalBackdrop,
            { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 12, 28) : 18 },
          ]}
          onPress={() => setVisible(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 10, 24) : 24,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.modalHeader, isRtl && styles.rtlRow]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('auth.selectInstitutionTitle')}
              </Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {ACADEMIC_INSTITUTIONS.map((institution) => {
                const isSelected = institution.name === value;
                return (
                  <Pressable
                    key={institution.shortName}
                    onPress={() => {
                      onChange(institution.name);
                      setVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalRow,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.surfaceElevated : colors.surfaceMuted,
                        opacity: pressed ? 0.9 : 1,
                      },
                      isRtl && styles.rtlRow,
                    ]}
                  >
                    <View style={styles.modalRowContent}>
                      <Text
                        style={[
                          styles.modalRowShortName,
                          { color: isSelected ? colors.primary : colors.textPrimary },
                          isHebrewUi && styles.rtlText,
                        ]}
                      >
                        {institution.shortName}
                      </Text>
                      <Text
                        style={[
                          styles.modalRowName,
                          { color: colors.textSecondary },
                          isHebrewUi && styles.rtlText,
                        ]}
                        numberOfLines={2}
                      >
                        {institution.name}
                      </Text>
                    </View>
                    {isSelected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  triggerRtl: {
    flexDirection: 'row-reverse',
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    maxHeight: '74%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalList: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  modalRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalRowContent: {
    flex: 1,
    gap: 2,
  },
  modalRowShortName: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalRowName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
