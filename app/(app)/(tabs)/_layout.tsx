import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

import { AppTabBar } from '../../../components/AppTabBar';
import { useAppLocale } from '../../../context/AppLocaleContext';
import { useWebDesktopLayout } from '../../../hooks/useWebDesktopLayout';

export default function TabsLayout() {
  const theme = useTheme();
  const { messages } = useAppLocale();
  const { isDesktopSplit } = useWebDesktopLayout();

  const screenOptions = useMemo(
    () => ({
      headerShown: false as const,
      tabBarShowLabel: true as const,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: '#6b7280',
    }),
    [theme.colors.primary]
  );

  const tabScreens = (
    <>
      <Tabs.Screen
        name="index"
        options={{
          title: messages.tabHome,
          tabBarLabel: messages.tabHome,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month-outline" color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="spese"
        options={{
          title: messages.tabSpese,
          tabBarLabel: messages.tabSpese,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cash-multiple" color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: messages.tabProfilo,
          tabBarLabel: messages.tabProfilo,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="impostazioni"
        options={{
          title: messages.tabImpostazioni,
          tabBarLabel: messages.tabImpostazioni,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" color={color} size={size ?? 24} />
          ),
        }}
      />
    </>
  );

  if (Platform.OS === 'web' && isDesktopSplit) {
    return (
      <Tabs tabBar={() => null} screenOptions={screenOptions}>
        {tabScreens}
      </Tabs>
    );
  }

  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={screenOptions}>
      {tabScreens}
    </Tabs>
  );
}
