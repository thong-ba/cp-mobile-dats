import * as Linking from 'expo-linking';
import React, { useEffect } from 'react';
import { MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#FF6A00',
    secondary: '#FFE0CC',
    surface: '#FFFFFF',
    background: '#F7F7F7',
  },
};

export default function App() {
  useEffect(() => {
    // Handle deep linking for OAuth callback
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      console.log('[App] Deep link received:', url);

      // Check if it's an OAuth callback
      if (url.includes('oauth2/success')) {
        // Navigation will be handled by OAuth2SuccessScreen
        // This is just for logging
      }
    };

    // Get initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </PaperProvider>
  );
}
