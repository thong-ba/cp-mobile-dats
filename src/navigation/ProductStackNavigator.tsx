import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HomeScreen } from '../screens/CommonScreens/ComonHomeScreen';
import { ProductListScreen } from '../screens/CommonScreens/ProductListScreen';
import { CartScreen } from '../screens/CustomerScreens/CartScreen';
import { CheckoutScreen } from '../screens/CustomerScreens/CheckoutScreen';
import { ProductDetailScreen } from '../screens/CustomerScreens/ProductDetailScreen';
import StorePage from '../screens/CustomerScreens/StorePage';
import { Cart } from '../types/cart';

export type ProductStackParamList = {
  Home: undefined;
  ProductList: undefined;
  ProductDetail: { productId: string };
  Store: { storeId: string };
  Cart: undefined;
  Checkout: { cart?: Cart } | undefined;
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
      <Stack.Screen name="ProductList" component={ProductListScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Store" component={StorePage} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
    </Stack.Navigator>
  );
}

