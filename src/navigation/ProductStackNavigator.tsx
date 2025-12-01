import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HomeScreen } from '../screens/CommonScreens/ComonHomeScreen';
import { CartScreen } from '../screens/CustomerScreens/CartScreen';
import { ProductDetailScreen } from '../screens/CustomerScreens/ProductDetailScreen';

export type ProductStackParamList = {
  Home: undefined;
  ProductDetail: { productId: string };
  Cart: undefined;
};

const Stack = createNativeStackNavigator<ProductStackParamList>();

export default function ProductStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
    </Stack.Navigator>
  );
}

