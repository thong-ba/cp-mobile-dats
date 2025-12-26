import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import AddressScreen from '../screens/CustomerScreens/AddressScreen/AddressScreen';
import { CartScreen } from '../screens/CustomerScreens/CartScreen';
import { CheckoutScreen } from '../screens/CustomerScreens/CheckoutScreen';
import { CreateAddressScreen } from '../screens/CustomerScreens/CreateAddressScreen';
import { EditAddressScreen } from '../screens/CustomerScreens/EditAddressScreen';
import NotificationsScreen from '../screens/CustomerScreens/NotificationsScreen/NotificationsScreen';
import OrderScreen from '../screens/CustomerScreens/OrderScreen';
import ProfileScreen from '../screens/CustomerScreens/ProfileScreen/ProfileScreen';
import { Cart } from '../types/cart';
import { CustomerAddress } from '../types/customer';

type SelectedVoucher = {
  shopVoucherId: string;
  code: string;
};

export type CustomerStackParamList = {
  ProfileMain: undefined;
  AddressList: undefined;
  CreateAddress: undefined;
  EditAddress: { address: CustomerAddress };
  Cart: undefined;
  Checkout:
    | {
        cart?: Cart;
        selectedCartItemIds?: string[];
        storeVouchers?: Record<string, SelectedVoucher>;
        productVouchers?: Record<string, SelectedVoucher>;
      }
    | undefined;
  Orders: { orderId?: string } | undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ProfileMain"
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
      <Stack.Screen name="Orders" component={OrderScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}


