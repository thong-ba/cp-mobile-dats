import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import AddressScreen from '../screens/CustomerScreens/AddressScreen/AddressScreen';
import { CartScreen } from '../screens/CustomerScreens/CartScreen';
import { CheckoutScreen } from '../screens/CustomerScreens/CheckoutScreen';
import { CreateAddressScreen } from '../screens/CustomerScreens/CreateAddressScreen';
import { EditAddressScreen } from '../screens/CustomerScreens/EditAddressScreen';
import ProfileScreen from '../screens/CustomerScreens/ProfileScreen/ProfileScreen';
import { Cart } from '../types/cart';
import { CustomerAddress } from '../types/customer';

export type CustomerStackParamList = {
  ProfileMain: undefined;
  AddressList: undefined;
  CreateAddress: undefined;
  EditAddress: { address: CustomerAddress };
  Cart: undefined;
  Checkout: { cart?: Cart } | undefined;
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="AddressList" component={AddressScreen} />
      <Stack.Screen name="CreateAddress" component={CreateAddressScreen} />
      <Stack.Screen name="EditAddress" component={EditAddressScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
    </Stack.Navigator>
  );
}


