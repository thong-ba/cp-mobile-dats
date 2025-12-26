import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainerRef } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { ChatProvider } from './src/context/ChatContext';
import AppNavigator from './src/navigation/AppNavigator';
import ChatScreen from './src/screens/CustomerScreens/ChatScreen/ChatScreen';

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
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Handle deep linking for OAuth callback and Checkout
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      console.log('[App] Deep link received:', url);

      // Check if it's an OAuth callback
      if (url.includes('oauth2/success')) {
        // Navigation will be handled by OAuth2SuccessScreen
        // This is just for logging
        return;
      }

      // Handle checkout success/cancel deep links
      // Hỗ trợ cả deep link (mobdoan://checkout/success) và web URL (https://.../checkout/success)
      if (url.includes('checkout/success')) {
        // Clear payment session
        AsyncStorage.removeItem('payment:session:v1').catch(() => {});
        
        // Navigate to Profile tab (Orders screen) để user xem đơn hàng
        setTimeout(() => {
          try {
            navigationRef.current?.navigate('Profile', {
              screen: 'Orders',
            });
          } catch (error) {
            // Fallback: chỉ navigate đến Profile tab
            navigationRef.current?.navigate('Profile');
          }
        }, 500);
      } else if (url.includes('checkout/cancel')) {
        // Clear payment session
        AsyncStorage.removeItem('payment:session:v1').catch(() => {});
        
        // User cancelled payment, navigate back to Profile
        setTimeout(() => {
          try {
            navigationRef.current?.navigate('Profile');
          } catch (error) {
            console.error('[App] Failed to navigate to Profile:', error);
          }
        }, 500);
      }
    };

    // Handle app state changes to detect when app comes back from PayOS
    // Lưu ý: Chỉ navigate khi app thực sự quay lại từ background (ví dụ từ PayOS)
    // Không navigate khi user chỉ đơn giản chuyển tab
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Chỉ xử lý khi app thực sự quay lại từ background/inactive
      // Không xử lý khi chỉ là tab switch
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        // Check if there's a payment session
        try {
          const paymentSession = await AsyncStorage.getItem('payment:session:v1');
          if (paymentSession) {
            const session = JSON.parse(paymentSession);
            const sessionAge = Date.now() - session.timestamp;
            
            // Only navigate if session is less than 5 minutes old (giảm từ 10 phút)
            // Và chỉ navigate nếu session type là 'payos' (từ PayOS checkout)
            if (sessionAge < 5 * 60 * 1000 && session.type === 'payos') {
              console.log('[App] Payment session found, navigating to Orders');
              // Clear payment session ngay lập tức để tránh navigate lại
              await AsyncStorage.removeItem('payment:session:v1');
              
              // Navigate to Orders screen
              setTimeout(() => {
                try {
                  navigationRef.current?.navigate('Profile', {
                    screen: 'Orders',
                  });
                } catch (error) {
                  console.error('[App] Failed to navigate to Orders:', error);
                }
              }, 500);
            } else {
              // Session expired hoặc không phải PayOS session, clear it
              await AsyncStorage.removeItem('payment:session:v1');
            }
          }
        } catch (error) {
          console.error('[App] Failed to check payment session:', error);
        }
      }
      appStateRef.current = nextAppState;
    };

    // Get initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
    
    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      linkingSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <ChatProvider>
          <AppNavigator navigationRef={navigationRef} />
          <ChatScreen />
        </ChatProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
