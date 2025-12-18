import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import RegisterScreen from '../screens/CommonScreens/CommonRegisterScreen/RegisterScreen';
import LoginScreen from '../screens/CommonScreens/ComonLoginScreen/LoginScreen';
import OAuth2SuccessScreen from '../screens/CommonScreens/OAuth2SuccessScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OAuth2Success: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OAuth2Success" component={OAuth2SuccessScreen} />
    </Stack.Navigator>
  );
}


