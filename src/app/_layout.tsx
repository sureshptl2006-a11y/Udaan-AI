import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { LanguageProvider } from '@/i18n/LanguageContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <LanguageProvider>
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="add-product" />
        <Stack.Screen name="ai-catalog" />
        <Stack.Screen name="explore" />
      </Stack>
    </ThemeProvider>
    </LanguageProvider>
  );
}