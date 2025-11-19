import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://iaqsfqremveqyzjtmvbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcXNmcXJlbXZlcXl6anRtdmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDIwOTEsImV4cCI6MjA3OTA3ODA5MX0.Ips85i0YGtkHn0VU4NANcvkDLMEYADK0m0MNaBlq8yM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
