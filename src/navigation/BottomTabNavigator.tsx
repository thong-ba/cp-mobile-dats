import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationsScreen } from '../screens/CustomerScreens/NotificationsScreen';
import AuthStackNavigator from './AuthStackNavigator';
import CustomerStackNavigator from './CustomerStackNavigator';
import ProductStackNavigator from './ProductStackNavigator';

const Tab = createBottomTabNavigator();

const ORANGE = '#FF6A00';

const ProfileTab = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <CustomerStackNavigator key="profile-auth" />;
  }
  return <AuthStackNavigator key="profile-guest" />;
};

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={ProductStackNavigator}
        options={{
          tabBarLabel: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Luôn reset navigation stack về Home screen khi Home tab được click
            // Đảm bảo luôn về Home screen, không giữ lại Cart, Checkout, hoặc màn hình khác
            const state = navigation.getState();
            const homeTabState = state.routes.find((r) => r.name === 'Home');
            
            // Kiểm tra xem có đang ở Home screen không
            const isAtHome = homeTabState?.state?.routes[homeTabState.state.index ?? 0]?.name === 'Home';
            
            if (!isAtHome) {
              // Prevent default navigation behavior
              e.preventDefault();
              
              // Reset navigation stack về Home screen trong ProductStackNavigator
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Home',
                      state: {
                        routes: [{ name: 'Home' }],
                        index: 0,
                      },
                    },
                  ],
                }),
              );
            }
          },
        })}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Thông báo',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTab}
        options={{
          tabBarLabel: 'Tôi',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Reset navigation stack về ProfileMain khi Profile tab được click
            const state = navigation.getState();
            const profileTabState = state.routes.find((r) => r.name === 'Profile');
            
            // Kiểm tra xem có đang ở ProfileMain screen không
            const isAtProfileMain = profileTabState?.state?.routes[profileTabState.state.index ?? 0]?.name === 'ProfileMain';
            
            if (!isAtProfileMain) {
              // Prevent default navigation behavior
              e.preventDefault();
              
              // Reset navigation stack về ProfileMain trong CustomerStackNavigator
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Profile',
                      state: {
                        routes: [{ name: 'ProfileMain' }],
                        index: 0,
                      },
                    },
                  ],
                }),
              );
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

