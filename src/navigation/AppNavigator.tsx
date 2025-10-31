import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import BottomTabNavigator from './BottomTabNavigator';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <BottomTabNavigator />
    </NavigationContainer>
  );
}
