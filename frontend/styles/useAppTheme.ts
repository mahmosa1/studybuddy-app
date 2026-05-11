import { getTheme } from '@/frontend/styles/designSystem';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAppTheme() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const theme = getTheme(mode);
  return { mode, theme, colors: theme.colors };
}
