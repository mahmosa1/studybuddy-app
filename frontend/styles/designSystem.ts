export type AppThemeMode = 'light' | 'dark';

export const lightTheme = {
  mode: 'light' as const,
  colors: {
    bg: '#F8FAFF',
    surface: '#FFFFFF',
    surfaceElevated: '#EEF2FF',
    surfaceMuted: '#F3F6FF',
    textPrimary: '#111827',
    textSecondary: '#64748B',
    textOnPrimary: '#FFFFFF',
    border: '#DDE3F0',
    primary: '#635BFF',
    primaryPressed: '#5B5FEF',
    accent: '#0891B2',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    dangerSurface: '#FEF2F2',
    dangerBorder: '#FECACA',
    chipBg: '#F2F5FF',
    statusBar: 'dark' as const,
  },
} as const;

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    bg: '#0B1020',
    surface: '#121A2B',
    surfaceElevated: '#1A243A',
    surfaceMuted: '#0F172A',
    textPrimary: '#E6ECFF',
    textSecondary: '#AAB7D6',
    textOnPrimary: '#FFFFFF',
    border: '#26324A',
    primary: '#6D5EF8',
    primaryPressed: '#5B4DE2',
    accent: '#22D3EE',
    success: '#34D399',
    warning: '#F59E0B',
    danger: '#F87171',
    dangerSurface: '#3A1F26',
    dangerBorder: '#7F1D1D',
    chipBg: '#1D2944',
    statusBar: 'light' as const,
  },
} as const;

export type ThemeColors = typeof lightTheme.colors;
export type AppTheme = typeof lightTheme | typeof darkTheme;

export function getTheme(mode: AppThemeMode): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

// Backward-compatible default palette for older screens.
export const palette = lightTheme.colors;

export const typography = {
  h1: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  button: { fontSize: 14, fontWeight: '700' as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const layout = {
  screenPadding: 16,
  sectionGap: 12,
  headerTopPadding: 0,
  headerBottomPadding: 10,
  headerIconSize: 22,
};

export const button = {
  height: 46,
  horizontalPadding: 16,
};

export const states = {
  info: '#38BDF8',
  success: lightTheme.colors.success,
  warning: lightTheme.colors.warning,
  danger: lightTheme.colors.danger,
};

export const iconContainer = {
  size: 36,
  radius: 12,
};
