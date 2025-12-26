import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import React from 'react';
import BottomTabNavigator from './BottomTabNavigator';

const linking = {
  prefixes: ['mobdoan://', 'https://mobdoan.com', 'https://*.mobdoan.com'],
  config: {
    screens: {
      Profile: {
        screens: {
          Orders: {
            path: 'checkout/success',
            parse: {
              orderId: (orderId: string) => orderId,
            },
          },
        },
      },
    },
  },
};

type AppNavigatorProps = {
  navigationRef?: React.RefObject<NavigationContainerRef<any> | null>;
};

export default function AppNavigator({ navigationRef }: AppNavigatorProps) {
  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <BottomTabNavigator />
    </NavigationContainer>
  );
}
