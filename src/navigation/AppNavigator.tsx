import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import BottomTabNavigator from './BottomTabNavigator';

const linking = {
  prefixes: ['mobdoan://', 'https://mobdoan.com', 'https://*.mobdoan.com'],
};

export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <BottomTabNavigator />
    </NavigationContainer>
  );
}
